import { NextResponse } from "next/server";

import { isGeneratedLogoPublicUrl, readGeneratedLogoBytesByPublicUrl, removeGeneratedLogoBackground, saveGeneratedLogoBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxProcessBytes = 12 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readImageUrl(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const imageUrl = value.imageUrl;
  return typeof imageUrl === "string" && isGeneratedLogoPublicUrl(imageUrl) ? imageUrl : undefined;
}

export async function POST(request: Request) {
  const imageUrl = readImageUrl(await request.json().catch(() => undefined));

  if (!imageUrl) {
    return NextResponse.json({ reason: "배경을 지울 로고 이미지를 찾을 수 없어요." }, { status: 400 });
  }

  const bytes = await readGeneratedLogoBytesByPublicUrl(imageUrl);

  if (!bytes) {
    return NextResponse.json({ reason: "로고 이미지 파일을 읽을 수 없어요." }, { status: 404 });
  }

  if (bytes.byteLength > maxProcessBytes) {
    return NextResponse.json({ reason: "로고 이미지가 너무 커서 배경을 지울 수 없어요. 더 작은 이미지로 다시 시도해 주세요." }, { status: 413 });
  }

  try {
    const processed = await removeGeneratedLogoBackground(bytes);
    const stored = await saveGeneratedLogoBytes(processed);
    return NextResponse.json({ imageUrl: stored.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Logo background removal failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ reason: "배경 지우기에 실패했어요. 더 선명한 로고 이미지로 다시 시도해 주세요." }, { status: 503 });
  }
}
