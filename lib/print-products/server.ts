import "server-only";

import OpenAI, { toFile } from "openai";
import { normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import { runLimitedImageGeneration, readOpenAIImageModel } from "@/lib/ai-business-card/image-generation";
import { getPrintProductPromptSettings } from "@/lib/server/print-product-settings";
import { saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset, PrintProductMockup, PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

type MockupRequest = {
  brandId: string;
  productType: PrintProductProductionType;
  brandName: string;
  category: string;
  request: string;
  layout: PrintProductProductionLayout;
  promptOverride?: string;
  referenceImage?: { bytes: Buffer; contentType: "image/png" | "image/jpeg" | "image/webp" };
};

function assertProductType(value: string): asserts value is PrintProductProductionType {
  if (value !== "banner" && value !== "signage" && value !== "flyer") {
    throw new Error("지원하지 않는 제작 상품이에요.");
  }
}

function readReferenceImageDataUrl(value: unknown): MockupRequest["referenceImage"] {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return undefined;
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=\s]+)$/.exec(value.trim());

  if (!match) {
    throw new Error("참고 이미지는 PNG, JPG, WEBP 형식만 사용할 수 있어요.");
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");

  if (bytes.byteLength <= 0 || bytes.byteLength > 8 * 1024 * 1024) {
    throw new Error("참고 이미지는 8MB 이하로 올려 주세요.");
  }

  return { bytes, contentType: match[1] as "image/png" | "image/jpeg" | "image/webp" };
}

export function parsePrintProductMockupRequest(value: unknown): MockupRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("제작 요청이 올바르지 않아요.");
  }

  const record = value as Record<string, unknown>;
  const brandId = typeof record.brandId === "string" ? record.brandId.trim() : "";
  const productType = typeof record.productType === "string" ? record.productType.trim() : "";
  const brandName = typeof record.brandName === "string" ? record.brandName.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const request = typeof record.request === "string" ? record.request.trim() : "";
  const promptOverride = typeof record.promptOverride === "string" ? record.promptOverride.trim() : undefined;
  const referenceImage = readReferenceImageDataUrl(record.referenceImageDataUrl);

  assertProductType(productType);

  if (!brandId || !brandName || typeof record.layout !== "object" || record.layout === null) {
    throw new Error("브랜드와 레이아웃 정보가 필요해요.");
  }

  return { brandId, productType, brandName, category, request, layout: normalizePrintProductLayout(record.layout as PrintProductProductionLayout), promptOverride, referenceImage };
}

export async function buildPrintProductMockupPrompt(input: MockupRequest) {
  const adapter = printProductAdapters[input.productType];
  const promptSettings = await getPrintProductPromptSettings().catch(() => undefined);
  const override = promptSettings?.[input.productType].mockupInstructions.trim();

  return [
    adapter.mockupPrompt,
    `Canvas ratio reference: ${input.layout.widthMm}mm x ${input.layout.heightMm}mm vertical artwork.`,
    `Selected background color: ${input.layout.backgroundColor}.`,
    input.category ? `Brand category for visual mood only: ${input.category}.` : "Use a polished commercial visual mood.",
    input.request ? `User background style request: ${input.request}` : "",
    input.referenceImage ? "A user-provided reference image is attached. Use it only as visual inspiration for mood, colors, texture, composition, or material feel. Do not copy any readable text, watermark, logo, QR code, person, or protected artwork from the reference image." : "",
    override ? `Admin additional instructions for this product only: ${override}` : "",
    "The image should be one uninterrupted surface with smooth gradients, soft lighting, subtle texture, gentle depth, and abstract decoration.",
    "Keep the composition fluid and organic from top to bottom. Avoid any structured advertising-design look.",
  ].filter(Boolean).join("\n");
}

export async function generatePrintProductMockup(input: MockupRequest): Promise<{ mockup: PrintProductMockup; asset: BrandAsset }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 생성 환경이 설정되지 않았어요.");
  }

  const adapter = printProductAdapters[input.productType];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = input.promptOverride?.trim() || await buildPrintProductMockupPrompt(input);
  const referenceImage = input.referenceImage;
  const response = referenceImage
    ? await runLimitedImageGeneration(async (signal) => client.images.edit({ model: readOpenAIImageModel(), image: await toFile(referenceImage.bytes, `print-product-reference.${referenceImage.contentType === "image/jpeg" ? "jpg" : referenceImage.contentType === "image/webp" ? "webp" : "png"}`, { type: referenceImage.contentType }), prompt, n: 1, size: "auto", output_format: "png" }, { signal }))
    : await runLimitedImageGeneration((signal) => client.images.generate({ model: readOpenAIImageModel(), prompt, n: 1, size: "1024x1024", output_format: "png" }, { signal }));
  const imageData = response.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error("AI 이미지 생성 결과가 비어 있어요.");
  }

  const createdAt = new Date().toISOString();
  const stored = await saveBrandAssetImageBytes(Buffer.from(imageData, "base64"));
  const title = `${adapter.title} 배경 후보`;
  const mockup: PrintProductMockup = { id: `print-product-mockup-${Date.now()}`, imageUrl: stored.publicUrl, cleanImageUrl: stored.publicUrl, title, createdAt };
  const asset: BrandAsset = { id: `brand-asset-${input.productType}-${Date.now()}`, brandId: input.brandId, sectionId: adapter.sectionId, productId: adapter.productId, title, description: input.request || adapter.description, imageUrl: stored.publicUrl, assetType: "mockup", createdAt };

  return { mockup, asset };
}
