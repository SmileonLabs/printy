import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { getAiBusinessCardPromptSettings, readAiBusinessCardPromptSettings, rollbackAiBusinessCardPromptSettings, saveAiBusinessCardPromptSettings } from "@/lib/server/ai-business-card-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ prompts: await getAiBusinessCardPromptSettings() });
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const settings = readAiBusinessCardPromptSettings(body);

  if (!settings) {
    return NextResponse.json({ reason: "AI 명함 프롬프트 형식이 올바르지 않아요." }, { status: 400 });
  }

  return NextResponse.json({ prompts: await saveAiBusinessCardPromptSettings(settings) });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const versionId = typeof body === "object" && body !== null && "versionId" in body && typeof body.versionId === "string" ? body.versionId : "";
  const prompts = versionId ? await rollbackAiBusinessCardPromptSettings(versionId) : undefined;

  if (!prompts) {
    return NextResponse.json({ reason: "롤백할 프롬프트 이력을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ prompts });
}
