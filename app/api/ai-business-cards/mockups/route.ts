import { NextResponse } from "next/server";
import { readAiBusinessCardInput } from "@/lib/ai-business-card/request";
import { createAiBusinessCardJob, getAiBusinessCardClientKey, wakeAiBusinessCardProcessor } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const input = readAiBusinessCardInput(body);
  const count = isRecord(body) && typeof body.count === "number" && Number.isFinite(body.count) ? body.count : 3;
  const signature = isRecord(body) && typeof body.signature === "string" ? body.signature.trim() : "";

  if (!input) {
    return NextResponse.json({ reason: "명함에 넣을 브랜드와 구성원 정보를 확인해 주세요." }, { status: 400 });
  }

  try {
    const response = await createAiBusinessCardJob("mockups", { ...(isRecord(body) ? body : {}), count }, getAiBusinessCardClientKey(request), signature || JSON.stringify({ input, count }));
    wakeAiBusinessCardProcessor();

    return NextResponse.json({ ...response, status: response.status === "succeeded" ? "succeeded" : "queued" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : "AI 명함 시안 생성을 시작하지 못했어요." }, { status: 400 });
  }
}
