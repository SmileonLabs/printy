import { NextResponse } from "next/server";
import { normalizeContact } from "@/lib/contact";
import { clearAdminSessionCookie, getAdminSession, isAllowedAdminContact, isValidAdminToken, setAdminSessionCookie } from "@/lib/server/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field : "";
}

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: getAdminSession(request) !== undefined });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "Invalid admin session request." }, { status: 400 });
  }

  const contact = normalizeContact(readString(body, "contact"));
  const token = readString(body, "token");

  if (!isAllowedAdminContact(contact) || !isValidAdminToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });

  return setAdminSessionCookie(response, contact);
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });

  return clearAdminSessionCookie(response);
}
