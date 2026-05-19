import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { getBankAccountSettings, readBankAccountSettings, saveBankAccountSettings } from "@/lib/server/admin-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ bankAccount: await getBankAccountSettings() });
}

export async function PUT(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const settings = readBankAccountSettings(body);

  if (!settings) {
    return NextResponse.json({ reason: "입금 계좌 정보 형식이 올바르지 않아요." }, { status: 400 });
  }

  return NextResponse.json({ bankAccount: await saveBankAccountSettings(settings) });
}
