import { NextResponse } from "next/server";

import { readBrandAssetBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => undefined);
    const cleanImageUrl = isRecord(body) && typeof body.cleanImageUrl === "string" ? body.cleanImageUrl.trim() : "";

    if (!cleanImageUrl) {
      return NextResponse.json({ reason: "후보정할 클린 배경 이미지 URL이 필요해요." }, { status: 400 });
    }

    const bytes = await readBrandAssetBytesByPublicUrl(cleanImageUrl);

    if (!bytes) {
      return NextResponse.json({ reason: "클린 배경 이미지를 읽을 수 없어요." }, { status: 404 });
    }

    const { sanitizeCleanBackgroundBackPanel } = await import("@/lib/ai-business-card/mockups");
    const processed = await sanitizeCleanBackgroundBackPanel(Buffer.from(bytes), { force: true });
    const stored = await saveBrandAssetImageBytes(processed);

    return NextResponse.json({ cleanImageUrl: stored.publicUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Clean background postprocess failed", { errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ reason: "클린 배경 후보정에 실패했어요. 잠시 후 다시 시도해 주세요." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
