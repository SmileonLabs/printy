import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { readOpenAIImageModel, runLimitedImageGeneration } from "@/lib/ai-business-card/image-generation";
import { buildAiBusinessCardCleanBackgroundPrompt, buildAiBusinessCardMockupPrompt } from "@/lib/ai-business-card/prompts";
import type { AiBusinessCardInput } from "@/lib/ai-business-card/schema";
import { getAiBusinessCardPromptSettings } from "@/lib/server/ai-business-card-settings";
import { readBrandAssetBytesByPublicUrl, readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BusinessCardTemplateLayout, PrintTemplate } from "@/lib/types";

export type AiBusinessCardMockup = {
  id: string;
  imageUrl: string;
  cleanImageUrl?: string;
  title: string;
  layout?: BusinessCardTemplateLayout;
};

export type AiBusinessCardReferenceImage = {
  bytes: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
};

export class AiBusinessCardMockupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBusinessCardMockupInputError";
  }
}

export class AiBusinessCardMockupGenerationError extends Error {
  readonly phase: "normal" | "clean";
  readonly status?: string | number;
  readonly code?: string | number;
  readonly type?: string | number;

  constructor(phase: "normal" | "clean", cause: unknown) {
    super("OpenAI business card mockup generation failed.");
    this.name = "AiBusinessCardMockupGenerationError";
    this.phase = phase;

    if (typeof cause === "object" && cause !== null) {
      const record = cause as Record<string, unknown>;
      this.status = typeof record.status === "string" || typeof record.status === "number" ? record.status : undefined;
      this.code = typeof record.code === "string" || typeof record.code === "number" ? record.code : undefined;
      this.type = typeof record.type === "string" || typeof record.type === "number" ? record.type : undefined;
    }
  }
}

const mockupSheetWidth = 920;
const mockupSideHeight = 520;

type Rgb = { r: number; g: number; b: number };

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbDistance(a: Rgb, b: Rgb) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function averageRgb(pixels: Uint8Array) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const a = pixels[i + 3];

    if (a < 200) {
      continue;
    }

    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
    count += 1;
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return { r: r / count, g: g / count, b: b / count };
}

export async function sanitizeCleanBackgroundBackPanel(bytes: Buffer) {
  const image = sharp(bytes).ensureAlpha();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return bytes;
  }

  const width = metadata.width;
  const height = metadata.height;
  const sideHeight = Math.floor(height / 2);

  if (sideHeight <= 0) {
    return bytes;
  }

  const backTop = sideHeight;
  const backHeight = height - backTop;

  // Sample a border around the back panel to estimate its background color.
  const border = Math.max(6, Math.min(18, Math.floor(Math.min(width, backHeight) * 0.02)));
  const backExtract = await sharp(bytes)
    .ensureAlpha()
    .extract({ left: 0, top: backTop, width, height: backHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const backPixels = new Uint8Array(backExtract.data);
  const borderPixels: number[] = [];
  const stride = width * 4;

  for (let y = 0; y < backHeight; y += 1) {
    const rowStart = y * stride;

    if (y < border || y >= backHeight - border) {
      for (let x = 0; x < width; x += 1) {
        const i = rowStart + x * 4;
        borderPixels.push(backPixels[i], backPixels[i + 1], backPixels[i + 2], backPixels[i + 3]);
      }
      continue;
    }

    for (let x = 0; x < border; x += 1) {
      const i = rowStart + x * 4;
      borderPixels.push(backPixels[i], backPixels[i + 1], backPixels[i + 2], backPixels[i + 3]);
    }

    for (let x = width - border; x < width; x += 1) {
      const i = rowStart + x * 4;
      borderPixels.push(backPixels[i], backPixels[i + 1], backPixels[i + 2], backPixels[i + 3]);
    }
  }

  const backBackground = averageRgb(Uint8Array.from(borderPixels));

  // Detect contamination near the top of the back panel (front bleed).
  const inspectHeight = Math.max(24, Math.floor(backHeight * 0.25));
  const inspect = await sharp(bytes)
    .ensureAlpha()
    .extract({ left: 0, top: backTop, width, height: inspectHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const inspectPixels = new Uint8Array(inspect.data);

  let contaminated = 0;
  let solid = 0;

  for (let i = 0; i + 3 < inspectPixels.length; i += 4) {
    const a = inspectPixels[i + 3];

    if (a < 200) {
      continue;
    }

    solid += 1;

    const pixel = { r: inspectPixels[i], g: inspectPixels[i + 1], b: inspectPixels[i + 2] };
    if (rgbDistance(pixel, backBackground) > 42) {
      contaminated += 1;
    }
  }

  const contaminationRatio = solid > 0 ? contaminated / solid : 0;

  if (contaminationRatio < 0.03) {
    return bytes;
  }

  // Replace the entire back panel with the estimated background color.
  const fill = {
    r: clampByte(backBackground.r),
    g: clampByte(backBackground.g),
    b: clampByte(backBackground.b),
    alpha: 255,
  };
  const backPanel = await sharp({ create: { width, height: backHeight, channels: 4, background: fill } }).png().toBuffer();
  return sharp(bytes)
    .ensureAlpha()
    .composite([{ input: backPanel, top: backTop, left: 0 }])
    .png()
    .toBuffer();
}

export function readAiBusinessCardReferenceImageDataUrl(value: unknown): AiBusinessCardReferenceImage | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);

  if (!match) {
    return undefined;
  }

  const bytes = Buffer.from(match[2], "base64");

  return bytes.length > 0 && bytes.length <= 8 * 1024 * 1024 ? { bytes, contentType: match[1] as AiBusinessCardReferenceImage["contentType"] } : undefined;
}

function decodeDataPng(value: string) {
  const prefix = "data:image/png;base64,";

  return value.startsWith(prefix) ? Buffer.from(value.slice(prefix.length), "base64") : undefined;
}

async function createBusinessCardSheetGuideBytes() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mockupSheetWidth}" height="${mockupSideHeight * 2}" viewBox="0 0 ${mockupSheetWidth} ${mockupSideHeight * 2}">
  <rect x="0" y="0" width="${mockupSheetWidth}" height="${mockupSideHeight * 2}" fill="#ffffff"/>
  <rect x="0" y="0" width="${mockupSheetWidth}" height="${mockupSideHeight}" fill="#fffdf8"/>
  <rect x="0" y="${mockupSideHeight}" width="${mockupSheetWidth}" height="${mockupSideHeight}" fill="#f8fbff"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function normalizeImageBytesForOpenAi(bytes: Buffer | Uint8Array) {
  return sharp(bytes).png().toBuffer();
}

function hasPlacedLayoutLogo(input: AiBusinessCardInput, template?: PrintTemplate) {
  const layout = input.productionOptions?.layout ?? template?.layout;

  return Boolean(layout?.sides.front.logo.visible || layout?.sides.back.logo.visible);
}

async function readLogoBytes(input: AiBusinessCardInput) {
  const logo = input.logo;

  if (!logo || !("imageUrl" in logo)) {
    throw new AiBusinessCardMockupInputError("대표 로고 이미지가 필요해요. 브랜드의 대표 로고를 먼저 생성하거나 등록해 주세요.");
  }

  if (logo.imageUrl.startsWith("data:image/png;base64,")) {
    const dataLogoBytes = decodeDataPng(logo.imageUrl);

    if (!dataLogoBytes) {
      throw new AiBusinessCardMockupInputError("대표 로고 이미지 파일을 읽을 수 없어요. 대표 로고를 다시 선택해 주세요.");
    }

    return normalizeImageBytesForOpenAi(dataLogoBytes);
  }

  const logoBytes = await readGeneratedLogoBytesByPublicUrl(logo.imageUrl) ?? await readBrandAssetBytesByPublicUrl(logo.imageUrl);

  if (!logoBytes) {
    throw new AiBusinessCardMockupInputError("대표 로고 이미지 파일을 읽을 수 없어요. 대표 로고를 다시 선택해 주세요.");
  }

  return normalizeImageBytesForOpenAi(logoBytes);
}

function referenceImageFileName(contentType: AiBusinessCardReferenceImage["contentType"]) {
  return contentType === "image/jpeg" ? "business-card-reference.jpg" : contentType === "image/webp" ? "business-card-reference.webp" : "business-card-reference.png";
}

export async function generateAiBusinessCardMockups(input: AiBusinessCardInput, count = 3, template?: PrintTemplate, referenceImage?: AiBusinessCardReferenceImage): Promise<AiBusinessCardMockup[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mockups: AiBusinessCardMockup[] = [];
  const total = Math.min(Math.max(Math.round(count), 1), 1);
  const shouldProvideLogoImageToAi = !hasPlacedLayoutLogo(input, template);
  const logoBytes = shouldProvideLogoImageToAi ? await readLogoBytes(input) : undefined;
  const guideBytes = await createBusinessCardSheetGuideBytes();
  const promptSettings = await getAiBusinessCardPromptSettings();

  for (let index = 0; index < total; index += 1) {
    const promptTemplate = template && input.productionOptions?.layout ? { ...template, layout: input.productionOptions.layout } : template;
    const prompt = `${buildAiBusinessCardMockupPrompt(input, index + 1, promptTemplate, promptSettings)}${referenceImage ? "\n\nA user-provided reference image is attached. Use it only as visual inspiration for mood, colors, texture, composition, or material feel. Do not copy any readable text, watermark, logo, QR code, person, or protected artwork from the reference image." : ""}`;
    const cleanPrompt = buildAiBusinessCardCleanBackgroundPrompt(index + 1, promptSettings);
    const imageFiles = [
      await toFile(guideBytes, "business-card-92x104-guide.png", { type: "image/png" }),
      ...(logoBytes ? [await toFile(logoBytes, "representative-logo.png", { type: "image/png" })] : []),
      ...(referenceImage ? [await toFile(referenceImage.bytes, referenceImageFileName(referenceImage.contentType), { type: referenceImage.contentType })] : []),
    ];
    const response = await runLimitedImageGeneration(async (signal) => client.images.edit({
          model: readOpenAIImageModel(),
          image: imageFiles.length > 1 ? imageFiles : imageFiles[0],
          prompt,
          n: 1,
          size: "auto",
          output_format: "png",
        }, { signal })).catch((error: unknown) => {
          throw new AiBusinessCardMockupGenerationError("normal", error);
        });
    const imageData = response.data?.[0]?.b64_json;

    if (!imageData) {
      throw new Error("OpenAI business card mockup generation returned no image data.");
    }

    const normalMockupBytes = Buffer.from(imageData, "base64");
    const stored = await saveBrandAssetImageBytes(normalMockupBytes);
    const cleanResponse = await runLimitedImageGeneration(async (signal) => client.images.edit({
          model: readOpenAIImageModel(),
          image: await toFile(normalMockupBytes, "completed-business-card-mockup.png", { type: "image/png" }),
          prompt: cleanPrompt,
          n: 1,
          size: "auto",
          output_format: "png",
        }, { signal })).catch((error: unknown) => {
          throw new AiBusinessCardMockupGenerationError("clean", error);
        });
    const cleanImageData = cleanResponse.data?.[0]?.b64_json;

    if (!cleanImageData) {
      throw new Error("OpenAI clean business card mockup generation returned no image data.");
    }

    const cleanMockupBytes = await sanitizeCleanBackgroundBackPanel(Buffer.from(cleanImageData, "base64"));
    const cleanStored = await saveBrandAssetImageBytes(cleanMockupBytes);

    mockups.push({ id: `ai-business-card-mockup-${Date.now()}-${index + 1}`, imageUrl: stored.publicUrl, cleanImageUrl: cleanStored.publicUrl, title: `AI 명함 시안 ${index + 1}` });
  }

  return mockups;
}

export async function editAiBusinessCardCleanBackground(cleanImageUrl: string, editRequest: string, referenceImage?: AiBusinessCardReferenceImage): Promise<AiBusinessCardMockup> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured.");
  }

  const prompt = editRequest.trim();

  if (!prompt) {
    throw new AiBusinessCardMockupInputError("수정할 배경 이미지 요청을 입력해 주세요.");
  }

  const cleanBytes = await readBrandAssetBytesByPublicUrl(cleanImageUrl);

  if (!cleanBytes) {
    throw new AiBusinessCardMockupInputError("수정할 클린 배경 목업 이미지를 읽을 수 없어요.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageFiles = [
    await toFile(cleanBytes, "clean-business-card-background.png", { type: "image/png" }),
    ...(referenceImage ? [await toFile(referenceImage.bytes, referenceImageFileName(referenceImage.contentType), { type: referenceImage.contentType })] : []),
  ];
  const response = await runLimitedImageGeneration(async (signal) => client.images.edit({
    model: readOpenAIImageModel(),
    image: imageFiles.length > 1 ? imageFiles : imageFiles[0],
    prompt: `Edit this Printy clean Korean business-card background sheet according to the user's request.

USER BACKGROUND EDIT REQUEST:
- ${prompt}

${referenceImage ? "A user-provided reference image is attached. Use it only as visual inspiration for mood, colors, texture, composition, or material feel. Do not copy any readable text, watermark, logo, QR code, person, or protected artwork from the reference image." : ""}

STRICT RULES:
- Preserve the 92mm x 104mm vertical sheet with two equal 92mm x 52mm panels: front on top, back on bottom.
- Keep the image flat, front-facing, orthographic, rectangular, and unwarped.
- Edit only background artwork, texture, color, decorative shapes, or ambience requested by the user.
- Do not add customer text, placeholder text, contact text, icons, QR codes, crop marks, guide lines, hands, desk, shadows, perspective, or 3D mockups.
- Do not add, move, duplicate, reinterpret, recolor, or redesign any representative logo that remains in the clean background.
- Leave areas intended for text/icons/QR clean and empty so Printy can redraw vectors later.
- Output one complete edited clean background sheet only.`,
    n: 1,
    size: "auto",
    output_format: "png",
  }, { signal })).catch((error: unknown) => {
    throw new AiBusinessCardMockupGenerationError("clean", error);
  });
  const imageData = response.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error("OpenAI clean background edit returned no image data.");
  }

  const stored = await saveBrandAssetImageBytes(await sanitizeCleanBackgroundBackPanel(Buffer.from(imageData, "base64")));

  return {
    id: `ai-business-card-background-edit-${Date.now()}`,
    imageUrl: stored.publicUrl,
    cleanImageUrl: stored.publicUrl,
    title: "수정된 배경 이미지",
  };
}
