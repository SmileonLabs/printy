import { NextResponse } from "next/server";
import { createAiBusinessCardJob, getAiBusinessCardClientKey, wakeAiBusinessCardProcessor } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const cleanImageUrl = isRecord(body) && typeof body.cleanImageUrl === "string" ? body.cleanImageUrl.trim() : "";
  const editRequest = isRecord(body) && typeof body.editRequest === "string" ? body.editRequest.trim() : "";

  if (!cleanImageUrl || !editRequest) {
    return NextResponse.json({ reason: "수정할 클린 배경 이미지와 요청 내용을 입력해 주세요." }, { status: 400 });
  }

  try {
    const response = await createAiBusinessCardJob("mockups", { backgroundEdit: true, cleanImageUrl, editRequest }, getAiBusinessCardClientKey(request), JSON.stringify({ backgroundEdit: true, cleanImageUrl, editRequest, requestedAt: Date.now() }));
    wakeAiBusinessCardProcessor();

    return NextResponse.json({ ...response, kind: "mockups", status: response.status === "succeeded" ? "succeeded" : "queued" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : "배경 이미지 수정을 시작하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
