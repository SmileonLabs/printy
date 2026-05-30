import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

import { isGeneratedLogoPublicUrl, readGeneratedLogoBytesByPublicUrl, saveGeneratedLogoBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const editTimeoutMs = 45_000;
const defaultOpenAIImageModel = "gpt-image-2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || defaultOpenAIImageModel;
}

function readImageUrl(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const imageUrl = value.imageUrl;
  return typeof imageUrl === "string" && isGeneratedLogoPublicUrl(imageUrl) ? imageUrl : undefined;
}

function buildPrompt() {
  return "Remove the background from this logo. Keep the original colors and shapes. Output a clean transparent-background PNG. Do not add any new text, shadows, gradients, or extra elements. Do not crop the logo tightly; keep comfortable padding.";
}

export async function POST(request: Request) {
  const imageUrl = readImageUrl(await request.json().catch(() => undefined));

  if (!imageUrl) {
    return NextResponse.json({ reason: "배경을 지울 로고 이미지를 찾을 수 없어요." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ reason: "배경 지우기 설정을 확인해야 해요. 관리자에게 OpenAI API 키 설정을 확인해 달라고 알려주세요." }, { status: 503 });
  }

  const bytes = await readGeneratedLogoBytesByPublicUrl(imageUrl);

  if (!bytes) {
    return NextResponse.json({ reason: "로고 이미지 파일을 읽을 수 없어요." }, { status: 404 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), editTimeoutMs);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.images.edit({
      model: readOpenAIImageModel(),
      image: await toFile(Buffer.from(bytes), "logo.png", { type: "image/png" }),
      prompt: buildPrompt(),
      n: 1,
      size: "1024x1024",
      output_format: "png",
    }, { signal: controller.signal });

    const base64 = response.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json({ reason: "배경 지우기 응답이 올바르지 않아요." }, { status: 502 });
    }

    const stored = await saveGeneratedLogoBytes(Buffer.from(base64, "base64"));
    return NextResponse.json({ imageUrl: stored.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (controller.signal.aborted) {
      return NextResponse.json({ reason: "배경 지우기가 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요." }, { status: 504 });
    }

    console.warn("Logo background removal failed", { errorName: error instanceof Error ? error.name : "UnknownError", status: typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : undefined });
    return NextResponse.json({ reason: "배경 지우기에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
