import { NextResponse } from "next/server";
import { readAiBusinessCardInput } from "@/lib/ai-business-card/request";
import { validateAiBusinessCardDesign } from "@/lib/ai-business-card/schema";
import { createAiBusinessCardJob, getAiBusinessCardClientKey, wakeAiBusinessCardProcessor } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const input = readAiBusinessCardInput(body);
  const signature = isRecord(body) && typeof body.signature === "string" ? body.signature.trim() : "";

  if (!input) {
    return NextResponse.json({ reason: "명함 PDF에 넣을 브랜드와 구성원 정보를 확인해 주세요." }, { status: 400 });
  }

  const design = validateAiBusinessCardDesign(isRecord(body) ? body.design : undefined);

  if (!design) {
    return NextResponse.json({ reason: "선택 목업으로 만든 인쇄용 레이아웃을 확인해 주세요." }, { status: 400 });
  }

  try {
    const response = await createAiBusinessCardJob("pdf", { ...(isRecord(body) ? body : {}), origin: new URL(request.url).origin }, getAiBusinessCardClientKey(request), signature || JSON.stringify({ input, design }));
    wakeAiBusinessCardProcessor();

    return NextResponse.json({ ...response, status: response.status === "succeeded" ? "succeeded" : "queued" }, { status: 202, headers: { "Cache-Control": "no-store", "X-Printy-PDF-Renderer": "chromium" } });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : "PDF 생성을 시작하지 못했어요." }, { status: 400 });
  }
}
