import { NextResponse } from "next/server";
import { readBrandWorkspace } from "@/lib/brand-workspace";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { loadBrandWorkspace, saveBrandWorkspace } from "@/lib/server/brand-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const malformedWorkspaceResponse = { reason: "브랜드 작업 공간 형식이 올바르지 않아요." };
const unavailableResponse = { reason: "브랜드 작업 공간을 사용할 수 없어요. 잠시 후 다시 시도해 주세요." };

export async function GET() {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    return NextResponse.json(await loadBrandWorkspace(session.user.id));
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const body = await request.json().catch(() => undefined);
    const workspace = readBrandWorkspace(body);

    if (!workspace) {
      return NextResponse.json(malformedWorkspaceResponse, { status: 400 });
    }

    return NextResponse.json(await saveBrandWorkspace(session.user.id, workspace));
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
