import { NextResponse } from "next/server";
import { getBankAccountSettings } from "@/lib/server/admin-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ bankAccount: await getBankAccountSettings() });
}
