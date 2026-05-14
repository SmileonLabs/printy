import { NextResponse } from "next/server";
import { createLogoShare } from "@/lib/server/logo-shares";
import { getCurrentDbSession } from "@/lib/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readShareInput(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const brandId = typeof record.brandId === "string" ? record.brandId.trim() : "";
  const logoId = typeof record.logoId === "string" ? record.logoId.trim() : "";

  return brandId && logoId ? { brandId, logoId } : undefined;
}

export async function POST(request: Request) {
  const session = await getCurrentDbSession().catch(() => undefined);

  if (!session) {
    return NextResponse.json({ reason: "로그인이 필요해요." }, { status: 401 });
  }

  const input = readShareInput(await request.json().catch(() => undefined));

  if (!input) {
    return NextResponse.json({ reason: "공유할 로고를 확인해 주세요." }, { status: 400 });
  }

  const share = await createLogoShare(session.user.id, input.brandId, input.logoId).catch(() => undefined);

  if (!share) {
    return NextResponse.json({ reason: "공유 링크를 만들 수 없어요." }, { status: 404 });
  }

  return NextResponse.json(share);
}
