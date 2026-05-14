import "server-only";

import OpenAI, { toFile } from "openai";
import { readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset } from "@/lib/types";

type BrandMockupInput = {
  brandId: string;
  brandName: string;
  category: string;
  logoImageUrl: string;
  sceneId: string;
};

type AiMockupScene = {
  id: string;
  title: string;
  description: string;
  prompt: string;
};

const defaultOpenAIImageModel = "gpt-image-2";

const aiMockupScenes: AiMockupScene[] = [
  {
    id: "standing-sign",
    title: "실사형 입간판 목업",
    description: "매장 앞 입간판에 로고를 자연스럽게 합성한 홍보 이미지",
    prompt: "Create a photorealistic Korean storefront A-frame standing sign mockup. Place the provided logo cleanly on the sign face as if printed vinyl signage. Keep the logo recognizable and centered, with realistic perspective, shadows, reflections, and outdoor street lighting. Do not redesign the logo or invent extra text.",
  },
  {
    id: "store-signboard",
    title: "매장 간판 목업",
    description: "외부 매장 간판에 로고를 적용한 실사형 목업",
    prompt: "Create a photorealistic storefront facade signboard mockup. Apply the provided logo to the main exterior sign above the entrance, preserving the logo as much as possible. Use realistic depth, material texture, shadows, and commercial street lighting. Do not redesign the logo or add unrelated words.",
  },
  {
    id: "paper-card",
    title: "명함/종이 목업",
    description: "고급 종이와 명함 위에 로고를 인쇄한 실사형 목업",
    prompt: "Create a photorealistic premium stationery mockup with business cards and textured paper on a desk. Print the provided logo on the front card and one paper item, preserving its shape and colors as much as possible. Use natural soft shadows and high-end brand presentation styling. Do not add unrelated text.",
  },
  {
    id: "cup-package",
    title: "컵/패키지 목업",
    description: "테이크아웃 컵과 포장재에 로고를 적용한 실사형 목업",
    prompt: "Create a photorealistic packaging mockup with a takeaway cup and simple paper bag on a cafe table. Apply the provided logo to the cup and bag as printed ink, preserving the logo as much as possible. Use realistic material texture, soft daylight, and natural shadows. Do not redesign the logo.",
  },
  {
    id: "window-decal",
    title: "유리창 스티커 목업",
    description: "매장 유리창 데칼에 로고를 합성한 실사형 목업",
    prompt: "Create a photorealistic glass window decal mockup for a small shop. Apply the provided logo as a clean vinyl decal on the glass, preserving the logo as much as possible. Include subtle reflections, street background blur, and realistic daylight. Do not add unrelated text.",
  },
];

function readOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || defaultOpenAIImageModel;
}

function getScene(sceneId: string) {
  return aiMockupScenes.find((scene) => scene.id === sceneId);
}

function buildPrompt(input: BrandMockupInput, scene: AiMockupScene) {
  const brandName = input.brandName.trim();
  const category = input.category.trim();

  return `${scene.prompt}\n\nBrand context: ${brandName}${category ? `, ${category}` : ""}. The input image is the brand logo. Use it as the source logo for the mockup. The final image should look like a polished commercial product mockup, not a flat design preview.`;
}

export async function generateBrandMockup(input: BrandMockupInput): Promise<BrandAsset> {
  const logoBytes = await readGeneratedLogoBytesByPublicUrl(input.logoImageUrl);

  if (!logoBytes) {
    throw new Error("Generated logo image is unavailable.");
  }

  const scene = getScene(input.sceneId);

  if (!scene) {
    throw new Error("Unknown brand mockup scene.");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.images.edit({
    model: readOpenAIImageModel(),
    image: await toFile(logoBytes, "brand-logo.png", { type: "image/png" }),
    prompt: buildPrompt(input, scene),
    n: 1,
    size: "1024x1024",
    output_format: "png",
  });
  const imageData = response.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error("OpenAI mockup generation returned no image data.");
  }

  const createdAt = new Date().toISOString();
  const stored = await saveBrandAssetImageBytes(Buffer.from(imageData, "base64"));

  return {
    id: `brand-asset-${scene.id}-${Date.now()}`,
    brandId: input.brandId,
    sectionId: "style",
    productId: `brand-mockup-${scene.id}`,
    title: scene.title,
    description: scene.description,
    imageUrl: stored.publicUrl,
    assetType: "mockup",
    createdAt,
  };
}
