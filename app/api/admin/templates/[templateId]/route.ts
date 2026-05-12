import { NextResponse } from "next/server";
import { parseBusinessCardTemplatePatch } from "@/lib/business-card-templates";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { deleteAdminBusinessCardTemplate, updateAdminBusinessCardTemplate } from "@/lib/server/business-card-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TemplateRouteContext = {
  params: Promise<{ templateId: string }>;
};

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function PATCH(request: Request, context: TemplateRouteContext) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const { templateId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const patch = parseBusinessCardTemplatePatch(body);

  if (!patch) {
    return NextResponse.json({ reason: "Invalid business-card template update." }, { status: 400 });
  }

  const template = await updateAdminBusinessCardTemplate(templateId, patch);

  if (!template) {
    return NextResponse.json({ reason: "Admin template not found." }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(request: Request, context: TemplateRouteContext) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const { templateId } = await context.params;
  const deleted = await deleteAdminBusinessCardTemplate(templateId);

  if (!deleted) {
    return NextResponse.json({ reason: "Admin template not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
