import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function removedResponse() {
  return NextResponse.json({ reason: "기존 템플릿 기반 명함 PDF 생성은 더 이상 지원하지 않아요. AI 명함 PDF 생성을 사용해 주세요." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return removedResponse();
}

export function POST() {
  return removedResponse();
}
