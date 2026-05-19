import { NextResponse } from "next/server";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { readUserFileArchiveDownload, userArchiveContentDisposition } from "@/lib/server/user-file-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentDbSession().catch(() => undefined);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { fileId } = await context.params;
  const download = await readUserFileArchiveDownload(session.user.id, fileId).catch(() => undefined);

  if (!download) {
    return NextResponse.json({ reason: "파일을 찾지 못했어요." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(download.bytes), {
    headers: {
      "Content-Type": download.file.contentType,
      "Content-Length": String(download.bytes.byteLength),
      "Content-Disposition": userArchiveContentDisposition(download.file.originalName),
    },
  });
}
