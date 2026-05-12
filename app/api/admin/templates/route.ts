import { NextResponse } from "next/server";
import { parseBusinessCardTemplateInput } from "@/lib/business-card-templates";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { createAdminBusinessCardTemplate, listAdminBusinessCardTemplates } from "@/lib/server/business-card-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const templates = await listAdminBusinessCardTemplates();

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const input = parseBusinessCardTemplateInput(body);

  if (!input) {
    return NextResponse.json({ reason: "Invalid business-card template." }, { status: 400 });
  }

  const template = await createAdminBusinessCardTemplate(input);

  return NextResponse.json({ template }, { status: 201 });
}
