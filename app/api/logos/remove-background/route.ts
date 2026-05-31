import { NextResponse } from "next/server";

import { isBrandAssetPublicUrl, isGeneratedLogoPublicUrl, readBrandAssetBytesByPublicUrl, readGeneratedLogoBytesByPublicUrl, removeGeneratedLogoBackground, saveGeneratedLogoBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxProcessBytes = 12 * 1024 * 1024;
const processTimeoutMs = 90_000;

class LogoBackgroundRemovalTimeoutError extends Error {
  constructor() {
    super("Logo background removal timed out.");
    this.name = "LogoBackgroundRemovalTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLogoImageUrl(imageUrl: string) {
  const trimmed = imageUrl.trim();

  if (trimmed.startsWith("/uploads/")) {
    return trimmed;
  }

  try {
    return new URL(trimmed).pathname;
  } catch {
    return trimmed;
  }
}

function readImageUrl(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const imageUrl = value.imageUrl;
  if (typeof imageUrl !== "string") {
    return undefined;
  }

  const normalizedImageUrl = normalizeLogoImageUrl(imageUrl);

  return isGeneratedLogoPublicUrl(normalizedImageUrl) || isBrandAssetPublicUrl(normalizedImageUrl) ? normalizedImageUrl : undefined;
}

async function readLogoBytesByPublicUrl(imageUrl: string) {
  return await readGeneratedLogoBytesByPublicUrl(imageUrl) ?? await readBrandAssetBytesByPublicUrl(imageUrl);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new LogoBackgroundRemovalTimeoutError()), timeoutMs);

    promise.then(resolve, reject).finally(() => clearTimeout(timeoutId));
  });
}

export async function POST(request: Request) {
  const imageUrl = readImageUrl(await request.json().catch(() => undefined));

  if (!imageUrl) {
    return NextResponse.json({ reason: "배경을 지울 로고 이미지를 찾을 수 없어요." }, { status: 400 });
  }

  const bytes = await readLogoBytesByPublicUrl(imageUrl);

  if (!bytes) {
    return NextResponse.json({ reason: "로고 이미지 파일을 읽을 수 없어요." }, { status: 404 });
  }

  if (bytes.byteLength > maxProcessBytes) {
    return NextResponse.json({ reason: "로고 이미지가 너무 커서 배경을 지울 수 없어요. 더 작은 이미지로 다시 시도해 주세요." }, { status: 413 });
  }

  try {
    const stored = await withTimeout((async () => {
      const processed = await removeGeneratedLogoBackground(bytes);
      return await saveGeneratedLogoBytes(processed);
    })(), processTimeoutMs);
    return NextResponse.json({ imageUrl: stored.publicUrl, debug: { size: stored.size } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Logo background removal failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : undefined,
    });
    if (error instanceof LogoBackgroundRemovalTimeoutError) {
      return NextResponse.json({ reason: "배경 지우기가 오래 걸려 중단됐어요. 잠시 후 다시 시도해 주세요." }, { status: 504, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ reason: "배경 지우기에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
