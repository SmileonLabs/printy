import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { createUserFileArchiveFile, listAdminFileArchiveFiles, listAdminFileArchiveUsers } from "@/lib/server/user-file-archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const [users, files] = await Promise.all([listAdminFileArchiveUsers(), listAdminFileArchiveFiles()]);

  return NextResponse.json({ users, files });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const formData = await request.formData().catch(() => undefined);

  if (!formData) {
    return NextResponse.json({ reason: "파일 업로드 요청을 읽지 못했어요." }, { status: 400 });
  }

  const userId = readText(formData.get("userId"));
  const displayName = readText(formData.get("displayName"));
  const note = readText(formData.get("note"));
  const file = formData.get("file");

  if (!userId || !(file instanceof File)) {
    return NextResponse.json({ reason: "유저와 파일을 선택해 주세요." }, { status: 400 });
  }

  try {
    const archiveFile = await createUserFileArchiveFile({
      userId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type || "application/octet-stream",
      originalName: file.name || "download-file",
      displayName,
      note,
    });

    return NextResponse.json({ file: archiveFile });
  } catch {
    return NextResponse.json({ reason: "파일을 보관함에 등록하지 못했어요." }, { status: 400 });
  }
}
