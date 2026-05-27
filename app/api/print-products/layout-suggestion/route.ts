import { NextResponse } from "next/server";
import { applyPrintProductLayoutIntent, fallbackPrintProductLayoutIntent, type PrintProductLayoutIntent } from "@/lib/print-products/ai-layout";
import { normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import type { PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

export const runtime = "nodejs";

function isProductType(value: unknown): value is PrintProductProductionType {
  return typeof value === "string" && value in printProductAdapters;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function readIntent(value: unknown, prompt: string): PrintProductLayoutIntent {
  if (!isRecord(value)) {
    return fallbackPrintProductLayoutIntent(prompt);
  }

  const fallback = fallbackPrintProductLayoutIntent(prompt);
  const layoutStyle = value.layoutStyle === "minimal_luxury" || value.layoutStyle === "bold_promo" || value.layoutStyle === "clean_modern" || value.layoutStyle === "friendly" ? value.layoutStyle : fallback.layoutStyle;
  const spacing = value.spacing === "compact" || value.spacing === "comfortable" || value.spacing === "wide" ? value.spacing : fallback.spacing;
  const logoPriority = value.logoPriority === "low" || value.logoPriority === "medium" || value.logoPriority === "high" ? value.logoPriority : fallback.logoPriority;
  const textAlignment = value.textAlignment === "left" || value.textAlignment === "center" || value.textAlignment === "right" ? value.textAlignment : fallback.textAlignment;

  return { layoutStyle, spacing, logoPriority, textAlignment };
}

async function requestIntentFromOpenAi({ prompt, brandName, category, productType }: { prompt: string; brandName: string; category: string; productType: PrintProductProductionType }) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackPrintProductLayoutIntent(prompt);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON for a print design layout intent. Keys: layoutStyle(minimal_luxury|bold_promo|clean_modern|friendly), spacing(compact|comfortable|wide), logoPriority(low|medium|high), textAlignment(left|center|right)." },
        { role: "user", content: JSON.stringify({ prompt, brandName, category, productType }) },
      ],
    }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  const content = isRecord(payload) && Array.isArray(payload.choices) ? (payload.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content : undefined;
  const parsed = typeof content === "string" ? JSON.parse(content) as unknown : undefined;

  if (!response.ok) {
    throw new Error("GPT 레이아웃 제안을 만들지 못했어요.");
  }

  return readIntent(parsed, prompt);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "레이아웃 요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const prompt = readString(body, "prompt");
  const brandName = readString(body, "brandName");
  const category = readString(body, "category");
  const productType = body.productType;
  const baseLayout = body.baseLayout;

  if (!prompt) {
    return NextResponse.json({ reason: "레이아웃 프롬프트를 입력해 주세요." }, { status: 400 });
  }

  if (!isProductType(productType) || !isRecord(baseLayout)) {
    return NextResponse.json({ reason: "상품 또는 레이아웃 정보가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const normalizedLayout = normalizePrintProductLayout(baseLayout as PrintProductProductionLayout);
    const intent = await requestIntentFromOpenAi({ prompt, brandName, category, productType });
    const layout = applyPrintProductLayoutIntent({ brandName, category, prompt, productType, baseLayout: normalizedLayout }, intent);

    return NextResponse.json({ intent, layout });
  } catch (error) {
    const normalizedLayout = normalizePrintProductLayout(baseLayout as PrintProductProductionLayout);
    const intent = fallbackPrintProductLayoutIntent(prompt);
    const layout = applyPrintProductLayoutIntent({ brandName, category, prompt, productType, baseLayout: normalizedLayout }, intent);

    return NextResponse.json({ reason: error instanceof Error ? error.message : "GPT 레이아웃 제안을 만들지 못했어요.", intent, layout, source: "fallback" });
  }
}
