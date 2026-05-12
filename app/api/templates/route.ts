import { NextResponse } from "next/server";
import { isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import { listAdminBusinessCardTemplates } from "@/lib/server/business-card-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const adminTemplates = await listAdminBusinessCardTemplates();
  const templates = adminTemplates.filter(isPublishedBusinessCardTemplate);

  return NextResponse.json({ templates });
}
