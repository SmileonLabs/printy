import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { readOpenAIImageModel, runLimitedImageGeneration } from "@/lib/ai-business-card/image-generation";
import { buildAiBusinessCardCleanBackgroundPrompt, buildAiBusinessCardMockupPrompt } from "@/lib/ai-business-card/prompts";
import type { AiBusinessCardInput } from "@/lib/ai-business-card/schema";
import { readBrandAssetBytesByPublicUrl, readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { PrintTemplate } from "@/lib/types";

export type AiBusinessCardMockup = {
  id: string;
  imageUrl: string;
  cleanImageUrl?: string;
  title: string;
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

function decodeDataPng(value: string) {
  const prefix = "data:image/png;base64,";

  return value.startsWith(prefix) ? Buffer.from(value.slice(prefix.length), "base64") : undefined;
}

async function createBusinessCardSheetGuideBytes() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="1040" viewBox="0 0 920 1040">
  <rect x="0" y="0" width="920" height="1040" fill="#ffffff" fill-opacity="0"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function normalizeBusinessCardSheetBytes(bytes: Buffer) {
  return sharp(bytes)
    .resize(920, 1040, { fit: "fill" })
    .png()
    .toBuffer();
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

    return dataLogoBytes;
  }

  const logoBytes = await readGeneratedLogoBytesByPublicUrl(logo.imageUrl) ?? await readBrandAssetBytesByPublicUrl(logo.imageUrl);

  if (!logoBytes) {
    throw new AiBusinessCardMockupInputError("대표 로고 이미지 파일을 읽을 수 없어요. 대표 로고를 다시 선택해 주세요.");
  }

  return logoBytes;
}

export async function generateAiBusinessCardMockups(input: AiBusinessCardInput, count = 3, template?: PrintTemplate): Promise<AiBusinessCardMockup[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mockups: AiBusinessCardMockup[] = [];
  const total = Math.min(Math.max(Math.round(count), 1), 1);
  const logoBytes = await readLogoBytes(input);
  const guideBytes = await createBusinessCardSheetGuideBytes();

  for (let index = 0; index < total; index += 1) {
    const prompt = buildAiBusinessCardMockupPrompt(input, index + 1, template);
    const cleanPrompt = buildAiBusinessCardCleanBackgroundPrompt(index + 1);
    const response = await runLimitedImageGeneration(async (signal) => client.images.edit({
          model: readOpenAIImageModel(),
          image: [
            await toFile(guideBytes, "business-card-92x104-guide.png", { type: "image/png" }),
            await toFile(logoBytes, "representative-logo.png", { type: "image/png" }),
          ],
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

    const normalMockupBytes = await normalizeBusinessCardSheetBytes(Buffer.from(imageData, "base64"));
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

    const cleanMockupBytes = await normalizeBusinessCardSheetBytes(Buffer.from(cleanImageData, "base64"));
    const stored = await saveBrandAssetImageBytes(normalMockupBytes);
    const cleanStored = await saveBrandAssetImageBytes(cleanMockupBytes);

    mockups.push({ id: `ai-business-card-mockup-${Date.now()}-${index + 1}`, imageUrl: stored.publicUrl, cleanImageUrl: cleanStored.publicUrl, title: `AI 명함 시안 ${index + 1}` });
  }

  return mockups;
}
