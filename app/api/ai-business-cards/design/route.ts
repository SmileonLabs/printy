import { NextResponse } from "next/server";
import { AiBusinessCardDesignError, createAiBusinessCardDesignFromTemplate } from "@/lib/ai-business-card/design";
import { readAiBusinessCardInput } from "@/lib/ai-business-card/request";
import { isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import { getAdminBusinessCardTemplate } from "@/lib/server/business-card-template-store";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const input = readAiBusinessCardInput(body);
  const templateId = input?.templateId ?? (isRecord(body) ? readString(body, "templateId") : "");

  if (!input) {
    return NextResponse.json({ reason: "명함에 넣을 브랜드와 구성원 정보를 확인해 주세요." }, { status: 400 });
  }

  try {
    const template = templateId ? await getAdminBusinessCardTemplate(templateId) : undefined;

    if (!template || !isPublishedBusinessCardTemplate(template)) {
      return NextResponse.json({ reason: "선택한 관리자 명함 템플릿을 찾지 못했어요. 명함 탭에서 다시 제작해 주세요." }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    const design = createAiBusinessCardDesignFromTemplate(input, template);

    return NextResponse.json({ design }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiBusinessCardDesignError) {
      return NextResponse.json({ reason: error.message }, { status: 422, headers: { "Cache-Control": "no-store" } });
    }

    console.error("AI business card JSON generation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: "AI 명함 레이아웃을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
