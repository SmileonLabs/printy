import { NextResponse } from "next/server";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { claimLogoShare, readPublicLogoShare } from "@/lib/server/logo-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const share = await readPublicLogoShare(token).catch(() => undefined);

  if (!share) {
    return NextResponse.json({ reason: "공유가 만료되었거나 이미 사용됐어요." }, { status: 404 });
  }

  return NextResponse.json(share);
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getCurrentDbSession().catch(() => undefined);

  if (!session) {
    return NextResponse.json({ reason: "로그인이 필요해요." }, { status: 401 });
  }

  const { token } = await context.params;
  const claimed = await claimLogoShare(token, session.user.id, session.user.name).catch(() => undefined);

  if (!claimed) {
    return NextResponse.json({ reason: "이미 사용된 공유 링크예요." }, { status: 409 });
  }

  return NextResponse.json({ claimed: true, brand: claimed.brand, logo: claimed.logo });
}
