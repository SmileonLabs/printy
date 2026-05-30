import { NextResponse } from "next/server";

import { sanitizeCleanBackgroundBackPanel } from "@/lib/ai-business-card/mockups";
import { readBrandAssetBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const cleanImageUrl = isRecord(body) && typeof body.cleanImageUrl === "string" ? body.cleanImageUrl.trim() : "";

  if (!cleanImageUrl) {
    return NextResponse.json({ reason: "후보정할 클린 배경 이미지 URL이 필요해요." }, { status: 400 });
  }

  const bytes = await readBrandAssetBytesByPublicUrl(cleanImageUrl);

  if (!bytes) {
    return NextResponse.json({ reason: "클린 배경 이미지를 읽을 수 없어요." }, { status: 404 });
  }

  const processed = await sanitizeCleanBackgroundBackPanel(Buffer.from(bytes));
  const stored = await saveBrandAssetImageBytes(processed);

  return NextResponse.json({ cleanImageUrl: stored.publicUrl }, { headers: { "Cache-Control": "no-store" } });
}
