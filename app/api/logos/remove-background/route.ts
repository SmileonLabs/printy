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

function readErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : undefined;
}

function readErrorString(error: unknown, key: "code" | "type") {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<"code" | "type", unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.slice(0, 500);
  }

  if (!isRecord(error)) {
    return undefined;
  }

  const message = error.message;
  return typeof message === "string" && message.trim().length > 0 ? message.trim().slice(0, 500) : undefined;
}

function readFailureMarkers(error: unknown) {
  const name = (error instanceof Error ? error.name : isRecord(error) && typeof error.name === "string" ? error.name : "UnknownError").toLowerCase();
  const code = readErrorString(error, "code")?.toLowerCase() ?? "";
  const type = readErrorString(error, "type")?.toLowerCase() ?? "";
  const message = readErrorMessage(error)?.toLowerCase() ?? "";

  return [name, code, type, message].join(" ");
}

function hasAuthMarker(markers: string) {
  return markers.includes("invalid_api_key") || markers.includes("authentication") || markers.includes("incorrect api key") || markers.includes("api key");
}

function hasPermissionMarker(markers: string) {
  return markers.includes("permission") || markers.includes("access_denied") || markers.includes("not_authorized") || markers.includes("organization") || markers.includes("verified");
}

function hasModelUnavailableMarker(markers: string) {
  return markers.includes("model_not_found") || markers.includes("model_not_available") || markers.includes("model_unavailable");
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

    const status = readErrorStatus(error);
    const code = readErrorString(error, "code");
    const type = readErrorString(error, "type");
    const markers = readFailureMarkers(error);

    console.warn("Logo background removal failed", { errorName: error instanceof Error ? error.name : "UnknownError", status, code, type, markers: markers.slice(0, 220) });

    if (status === 400) {
      return NextResponse.json({ reason: "로고 배경을 지울 수 없어요. 더 선명한 로고 이미지로 다시 시도해 주세요." }, { status: 422 });
    }

    if (status === 401 || status === 403) {
      if (hasAuthMarker(markers)) {
        return NextResponse.json({ reason: "OpenAI API 키 인증에 실패했어요. Cloudflare 환경변수 OPENAI_API_KEY를 다시 확인해 주세요." }, { status: 503 });
      }

      if (hasModelUnavailableMarker(markers)) {
        return NextResponse.json({ reason: "OpenAI 이미지 모델을 사용할 수 없어요. Cloudflare OPENAI_IMAGE_MODEL 또는 모델 접근 권한을 확인해 주세요." }, { status: 503 });
      }

      if (hasPermissionMarker(markers)) {
        return NextResponse.json({ reason: "OpenAI 이미지 모델 접근 권한이 막혔어요. 조직 인증/프로젝트 권한/모델 권한을 확인해 주세요." }, { status: 503 });
      }

      return NextResponse.json({ reason: "배경 지우기 권한 설정을 확인해야 해요. 관리자에게 OpenAI 설정을 확인해 달라고 알려주세요." }, { status: 503 });
    }

    if (status === 429) {
      return NextResponse.json({ reason: "배경 지우기 요청이 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    return NextResponse.json({ reason: "배경 지우기에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
