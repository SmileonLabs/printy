import { NextResponse } from "next/server";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { listUserFileArchiveFiles } from "@/lib/server/user-file-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentDbSession().catch(() => undefined);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ files: await listUserFileArchiveFiles(session.user.id) });
}
