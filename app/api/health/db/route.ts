import { NextResponse } from "next/server";
import { queryDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await queryDb<{ ok: number }>("select 1 as ok");

    return NextResponse.json({ ok: result.rows[0]?.ok === 1 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
