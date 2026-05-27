import { NextResponse } from "next/server";
import { buildPrintProductMockupPrompt, generatePrintProductMockup, parsePrintProductMockupRequest } from "@/lib/print-products/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  try {
    const parsed = parsePrintProductMockupRequest(body);
    const promptOnly = typeof body === "object" && body !== null && "promptOnly" in body && body.promptOnly === true;

    if (promptOnly) {
      return NextResponse.json({ prompt: await buildPrintProductMockupPrompt(parsed) });
    }

    const result = await generatePrintProductMockup(parsed);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Print product mockup generation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: error instanceof Error ? error.message : "AI 제작 이미지를 만들지 못했어요." }, { status: 400 });
  }
}
