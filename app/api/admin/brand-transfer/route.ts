import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { listAdminBrandTransferData, transferAdminBrand } from "@/lib/server/admin-brand-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json(await listAdminBrandTransferData());
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => undefined);

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ reason: "브랜드 이관 요청을 읽지 못했어요." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const sourceUserId = readString(record.sourceUserId);
  const targetUserId = readString(record.targetUserId);
  const brandId = readString(record.brandId);

  if (!sourceUserId || !targetUserId || !brandId || sourceUserId === targetUserId) {
    return NextResponse.json({ reason: "원본 계정, 대상 계정, 브랜드를 올바르게 선택해 주세요." }, { status: 400 });
  }

  try {
    return NextResponse.json({ result: await transferAdminBrand({ sourceUserId, targetUserId, brandId }) });
  } catch (error) {
    const reason = error instanceof Error && error.message === "Target user already has this brand id." ? "대상 계정에 같은 브랜드 ID가 이미 있어요." : error instanceof Error && error.message === "Target user has conflicting child ids." ? "대상 계정에 같은 하위 데이터 ID가 있어요." : "브랜드를 이관하지 못했어요.";

    return NextResponse.json({ reason }, { status: 400 });
  }
}
