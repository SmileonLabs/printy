import { NextResponse } from "next/server";
import { applyBusinessCardLayoutIntent, fallbackBusinessCardLayoutIntent, normalizeBusinessCardLayoutIntent, type BusinessCardLayoutMemberContext } from "@/lib/ai-business-card/layout-suggestion";
import { normalizeBusinessCardTemplateLayout } from "@/lib/business-card-templates";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function readMemberContext(value: unknown): BusinessCardLayoutMemberContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    name: readString(value, "name"),
    role: readString(value, "role"),
    phone: readString(value, "phone"),
    mainPhone: readString(value, "mainPhone"),
    fax: readString(value, "fax"),
    email: readString(value, "email"),
    website: readString(value, "website"),
    address: readString(value, "address"),
    account: readString(value, "account"),
    instagram: readString(value, "instagram"),
    qrCodeImageUrl: readString(value, "qrCodeImageUrl"),
  };
}

function readMemberContexts(value: unknown) {
  return Array.isArray(value) ? value.map(readMemberContext).filter((member): member is BusinessCardLayoutMemberContext => member !== undefined) : [];
}

async function requestIntentFromOpenAi({ prompt, hasLogo, primaryMember, selectedMembers }: { prompt: string; hasLogo: boolean; primaryMember?: BusinessCardLayoutMemberContext; selectedMembers: BusinessCardLayoutMemberContext[] }) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackBusinessCardLayoutIntent(prompt, primaryMember);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON for a Korean business card layout intent. Keys: layoutStyle(minimal_luxury|bold_promo|clean_modern|friendly), spacing(compact|comfortable|wide), logoPriority(low|medium|high), textAlignment(left|center|right). Use only the user's layout prompt, logo presence, and the provided team/member fields. Ignore icons, decorative lines, slogans, sample text, category, and any other elements. Do not invent text; choose an intent that makes the provided member fields fit cleanly." },
        { role: "user", content: JSON.stringify({ prompt, logo: { present: hasLogo }, primaryMember, selectedMembers }) },
      ],
    }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  const content = isRecord(payload) && Array.isArray(payload.choices) ? (payload.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content : undefined;
  const parsed = typeof content === "string" ? JSON.parse(content) as unknown : undefined;

  if (!response.ok) {
    throw new Error("GPT 명함 레이아웃 제안을 만들지 못했어요.");
  }

  return normalizeBusinessCardLayoutIntent(parsed, prompt, primaryMember);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "레이아웃 요청 형식이 올바르지 않아요." }, { status: 400 });
  }

  const prompt = readString(body, "prompt");
  const hasLogo = isRecord(body.logo) ? body.logo.present === true : true;
  const primaryMember = readMemberContext(body.primaryMember);
  const selectedMembers = readMemberContexts(body.selectedMembers);
  const baseLayout = normalizeBusinessCardTemplateLayout(body.baseLayout);

  if (!prompt) {
    return NextResponse.json({ reason: "레이아웃 프롬프트를 입력해 주세요." }, { status: 400 });
  }

  if (!baseLayout) {
    return NextResponse.json({ reason: "명함 레이아웃 정보가 올바르지 않아요." }, { status: 400 });
  }

  try {
    const intent = await requestIntentFromOpenAi({ prompt, hasLogo, primaryMember, selectedMembers });
    const layout = applyBusinessCardLayoutIntent({ prompt, baseLayout, primaryMember, selectedMembers }, intent);

    return NextResponse.json({ intent, layout });
  } catch (error) {
    const intent = fallbackBusinessCardLayoutIntent(prompt, primaryMember);
    const layout = applyBusinessCardLayoutIntent({ prompt, baseLayout, primaryMember, selectedMembers }, intent);

    return NextResponse.json({ reason: error instanceof Error ? error.message : "GPT 명함 레이아웃 제안을 만들지 못했어요.", intent, layout, source: "fallback" });
  }
}
