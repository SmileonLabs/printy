import { NextResponse } from "next/server";
import { normalizeDesignProject } from "@/lib/design-projects";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { deleteDesignProject, loadDesignProject, saveDesignProject } from "@/lib/server/design-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DesignProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const notFoundResponse = { reason: "디자인 프로젝트를 찾지 못했어요." };
const invalidResponse = { reason: "디자인 프로젝트 형식이 올바르지 않아요." };
const unavailableResponse = { reason: "디자인 프로젝트를 사용할 수 없어요. 잠시 후 다시 시도해 주세요." };

export async function GET(_request: Request, context: DesignProjectRouteContext) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const { projectId } = await context.params;
    const project = await loadDesignProject(session.user.id, projectId);

    if (!project) {
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function PUT(request: Request, context: DesignProjectRouteContext) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const { projectId } = await context.params;
    const body = await request.json().catch(() => undefined);
    const project = normalizeDesignProject(body);

    if (!project || project.id !== projectId) {
      return NextResponse.json(invalidResponse, { status: 400 });
    }

    return NextResponse.json({ project: await saveDesignProject(session.user.id, project) });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: DesignProjectRouteContext) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const { projectId } = await context.params;
    const deleted = await deleteDesignProject(session.user.id, projectId);

    if (!deleted) {
      return NextResponse.json(notFoundResponse, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
