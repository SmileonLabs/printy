import { NextResponse } from "next/server";
import { applyBusinessCardLayoutIntent, fallbackBusinessCardLayoutIntent, normalizeBusinessCardLayoutIntent } from "@/lib/ai-business-card/layout-suggestion";
import { normalizeBusinessCardTemplateLayout } from "@/lib/business-card-templates";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

async function requestIntentFromOpenAi({ prompt, brandName, category }: { prompt: string; brandName: string; category: string }) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackBusinessCardLayoutIntent(prompt);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON for a Korean business card layout intent. Keys: layoutStyle(minimal_luxury|bold_promo|clean_modern|friendly), spacing(compact|comfortable|wide), logoPriority(low|medium|high), textAlignment(left|center|right)." },
        { role: "user", content: JSON.stringify({ prompt, brandName, category }) },
      ],
    }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  const content = isRecord(payload) && Array.isArray(payload.choices) ? (payload.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content : undefined;
  const parsed = typeof content === "string" ? JSON.parse(content) as unknown : undefined;

  if (!response.ok) {
    throw new Error("GPT 명함 레이아웃 제안을 만들지 못했어요.");
  }

  return normalizeBusinessCardLayoutIntent(parsed, prompt);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "레이아웃 요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const prompt = readString(body, "prompt");
  const brandName = readString(body, "brandName");
  const category = readString(body, "category");
  const baseLayout = normalizeBusinessCardTemplateLayout(body.baseLayout);

  if (!prompt) {
    return NextResponse.json({ reason: "레이아웃 프롬프트를 입력해 주세요." }, { status: 400 });
  }

  if (!baseLayout) {
    return NextResponse.json({ reason: "명함 레이아웃 정보가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const intent = await requestIntentFromOpenAi({ prompt, brandName, category });
    const layout = applyBusinessCardLayoutIntent({ brandName, category, prompt, baseLayout }, intent);

    return NextResponse.json({ intent, layout });
  } catch (error) {
    const intent = fallbackBusinessCardLayoutIntent(prompt);
    const layout = applyBusinessCardLayoutIntent({ brandName, category, prompt, baseLayout }, intent);

    return NextResponse.json({ reason: error instanceof Error ? error.message : "GPT 명함 레이아웃 제안을 만들지 못했어요.", intent, layout, source: "fallback" });
  }
}
