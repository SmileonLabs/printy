import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { listAdminLogoGenerationStatus } from "@/lib/server/admin-logo-generation-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ accounts: await listAdminLogoGenerationStatus() });
}
