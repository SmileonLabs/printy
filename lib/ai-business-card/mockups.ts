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

export async function generateAiBusinessCardMockups(input: AiBusinessCardInput, count = 3, template?: PrintTemplate): Promise<AiBusinessCardMockup[]> {
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
    const prompt = buildAiBusinessCardMockupPrompt(input, index + 1, promptTemplate, promptSettings);
    const cleanPrompt = buildAiBusinessCardCleanBackgroundPrompt(index + 1, promptSettings);
    const response = await runLimitedImageGeneration(async (signal) => client.images.edit({
          model: readOpenAIImageModel(),
          image: logoBytes ? [
            await toFile(guideBytes, "business-card-92x104-guide.png", { type: "image/png" }),
            await toFile(logoBytes, "representative-logo.png", { type: "image/png" }),
          ] : await toFile(guideBytes, "business-card-92x104-guide.png", { type: "image/png" }),
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

    const cleanMockupBytes = Buffer.from(cleanImageData, "base64");
    const cleanStored = await saveBrandAssetImageBytes(cleanMockupBytes);

    mockups.push({ id: `ai-business-card-mockup-${Date.now()}-${index + 1}`, imageUrl: stored.publicUrl, cleanImageUrl: cleanStored.publicUrl, title: `AI 명함 시안 ${index + 1}` });
  }

  return mockups;
}

export async function editAiBusinessCardCleanBackground(cleanImageUrl: string, editRequest: string): Promise<AiBusinessCardMockup> {
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
  const response = await runLimitedImageGeneration(async (signal) => client.images.edit({
    model: readOpenAIImageModel(),
    image: await toFile(cleanBytes, "clean-business-card-background.png", { type: "image/png" }),
    prompt: `Edit this Printy clean Korean business-card background sheet according to the user's request.

USER BACKGROUND EDIT REQUEST:
- ${prompt}

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

  const stored = await saveBrandAssetImageBytes(Buffer.from(imageData, "base64"));

  return {
    id: `ai-business-card-background-edit-${Date.now()}`,
    imageUrl: stored.publicUrl,
    cleanImageUrl: stored.publicUrl,
    title: "수정된 배경 이미지",
  };
}
