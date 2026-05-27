import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { uploadAdminGeneratedLogoVector, vectorizeAdminGeneratedLogo } from "@/lib/server/admin-logo-generation-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonText(value: unknown, key: string) {
  return typeof value === "object" && value !== null && key in value && typeof (value as Record<string, unknown>)[key] === "string" ? ((value as Record<string, string>)[key]).trim() : "";
}

function readQuality(value: unknown) {
  const quality = readJsonText(value, "quality");

  return quality === "high" ? "high" : "fast";
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const userId = readText(formData.get("userId"));
      const logoId = readText(formData.get("logoId"));
      const file = formData.get("file");

      if (!userId || !logoId || !(file instanceof File)) {
        return NextResponse.json({ reason: "사용자, 로고, SVG 파일을 확인해 주세요." }, { status: 400 });
      }

      if (file.size <= 0 || file.size > 1024 * 1024) {
        return NextResponse.json({ reason: "SVG 파일은 1MB 이하로 올려 주세요." }, { status: 413 });
      }

      const svg = await file.text();

      return NextResponse.json({ logo: await uploadAdminGeneratedLogoVector(userId, logoId, svg) }, { headers: { "Cache-Control": "no-store" } });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const userId = readJsonText(body, "userId");
    const logoId = readJsonText(body, "logoId");
    const quality = readQuality(body);

    if (!userId || !logoId) {
      return NextResponse.json({ reason: "사용자와 로고를 선택해 주세요." }, { status: 400 });
    }

    return NextResponse.json({ logo: await vectorizeAdminGeneratedLogo(userId, logoId, quality) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ reason: error instanceof Error ? error.message : "로고 벡터 작업을 처리하지 못했어요." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
