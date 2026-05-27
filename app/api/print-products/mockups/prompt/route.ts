import { NextResponse } from "next/server";
import { buildPrintProductMockupPrompt, parsePrintProductMockupRequest } from "@/lib/print-products/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  try {
    const parsed = parsePrintProductMockupRequest(body);

    return NextResponse.json({ prompt: await buildPrintProductMockupPrompt(parsed) });
  } catch (error) {
    console.error("Print product mockup prompt preview failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: error instanceof Error ? error.message : "최종 프롬프트를 만들지 못했어요." }, { status: 400 });
  }
}
