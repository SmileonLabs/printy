import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PromptShapeSuggestion = {
  label: string;
  glyph: string;
  fillColor: string;
  strokeColor: string;
  textColor: string;
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function readSuggestion(value: unknown, prompt: string): PromptShapeSuggestion {
  if (typeof value !== "object" || value === null) {
    return fallbackSuggestion(prompt);
  }

  const record = value as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim().slice(0, 16) : "프롬프트 아이콘";
  const glyph = typeof record.glyph === "string" ? record.glyph.trim().slice(0, 3) : "AI";

  return {
    label: label || "프롬프트 아이콘",
    glyph: glyph || "AI",
    fillColor: isHexColor(record.fillColor) ? record.fillColor : "#ffffff",
    strokeColor: isHexColor(record.strokeColor) ? record.strokeColor : "#111827",
    textColor: isHexColor(record.textColor) ? record.textColor : "#111827",
  };
}

function fallbackSuggestion(prompt: string): PromptShapeSuggestion {
  if (/insta|인스타/i.test(prompt)) {
    return { label: "인스타그램", glyph: "IG", fillColor: "#ffffff", strokeColor: "#E1306C", textColor: "#E1306C" };
  }

  return { label: "프롬프트 아이콘", glyph: "AI", fillColor: "#ffffff", strokeColor: "#111827", textColor: "#111827" };
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const promptFromBody = typeof body === "object" && body !== null && "prompt" in body && typeof body.prompt === "string" ? body.prompt.trim() : "";
  const prompt = promptFromBody || new URL(request.url).searchParams.get("prompt")?.trim() || "";

  if (!prompt) {
    return NextResponse.json({ reason: "아이콘 프롬프트를 입력해 주세요." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ reason: "GPT 요청 환경이 설정되지 않았어요.", suggestion: fallbackSuggestion(prompt), source: "fallback" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only JSON for a simple printable circular icon marker. Keys: label, glyph, fillColor, strokeColor, textColor. glyph must be 1-3 plain characters, no emoji. Colors must be #RRGGBB." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    const content = typeof payload === "object" && payload !== null && "choices" in payload && Array.isArray((payload as { choices?: unknown }).choices)
      ? ((payload as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message?.content)
      : undefined;
    const parsed = typeof content === "string" ? JSON.parse(content) as unknown : undefined;

    if (!response.ok) {
      throw new Error("GPT 아이콘 제안을 만들지 못했어요.");
    }

    return NextResponse.json({ suggestion: readSuggestion(parsed, prompt) });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : "GPT 아이콘 제안을 만들지 못했어요.", suggestion: fallbackSuggestion(prompt) }, { status: 400 });
  }
}
