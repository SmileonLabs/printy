import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { getPrintProductPromptSettings, readPrintProductPromptSettings, rollbackPrintProductPromptSettings, savePrintProductPromptSettings } from "@/lib/server/print-product-settings";
import type { PrintProductProductionType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readProductType(value: unknown): PrintProductProductionType | undefined {
  return value === "banner" || value === "signage" || value === "flyer" ? value : undefined;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ prompts: await getPrintProductPromptSettings() });
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const settings = readPrintProductPromptSettings(body);

  if (!settings) {
    return NextResponse.json({ reason: "제작 상품 프롬프트 형식이 올바르지 않아요." }, { status: 400 });
  }

  return NextResponse.json({ prompts: await savePrintProductPromptSettings(settings) });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => undefined);
  const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const productType = readProductType(record.productType);
  const versionId = typeof record.versionId === "string" ? record.versionId : "";
  const prompts = productType && versionId ? await rollbackPrintProductPromptSettings(productType, versionId) : undefined;

  if (!prompts) {
    return NextResponse.json({ reason: "롤백할 제작 상품 프롬프트 이력을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ prompts });
}
