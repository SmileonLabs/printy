import { NextResponse } from "next/server";
import { listPublishedBrandMockupTemplates } from "@/lib/server/brand-mockup-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const templates = await listPublishedBrandMockupTemplates();

  return NextResponse.json({ templates });
}
