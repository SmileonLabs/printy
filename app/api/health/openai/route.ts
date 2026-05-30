import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
  const model = (process.env.OPENAI_IMAGE_MODEL ?? "").trim() || "(default)";

  return NextResponse.json(
    {
      ok: true,
      hasOpenAiApiKey: hasApiKey,
      openAiImageModel: model,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
