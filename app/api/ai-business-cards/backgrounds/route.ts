import { NextResponse } from "next/server";
import { AiBusinessCardBackgroundError, createCleanBusinessCardBackgrounds } from "@/lib/ai-business-card/backgrounds";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const cleanMockupImageUrl = isRecord(body) && typeof body.cleanMockupImageUrl === "string" ? body.cleanMockupImageUrl.trim() : "";

  if (!cleanMockupImageUrl) {
    return NextResponse.json({ reason: "배경으로 사용할 클린 명함 목업 이미지를 확인해 주세요." }, { status: 400 });
  }

  try {
    const backgrounds = await createCleanBusinessCardBackgrounds(cleanMockupImageUrl);

    return NextResponse.json({ backgrounds }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiBusinessCardBackgroundError) {
      return NextResponse.json({ reason: "선택 목업의 앞면/뒷면 배경 이미지를 준비하지 못했어요. 다시 시도해 주세요." }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    throw error;
  }
}
