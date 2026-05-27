import { NextResponse } from "next/server";
import { normalizeDesignProject } from "@/lib/design-projects";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { loadDesignProjects, saveDesignProject } from "@/lib/server/design-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const invalidResponse = { reason: "디자인 프로젝트 형식이 올바르지 않아요." };
const unavailableResponse = { reason: "디자인 프로젝트를 사용할 수 없어요. 잠시 후 다시 시도해 주세요." };

function readOptionalSearchParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim();

  return value ? value : undefined;
}

export async function GET(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const url = new URL(request.url);

    return NextResponse.json({ projects: await loadDesignProjects(session.user.id, readOptionalSearchParam(url, "brandId")) });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const body = await request.json().catch(() => undefined);
    const project = normalizeDesignProject(body);

    if (!project) {
      return NextResponse.json(invalidResponse, { status: 400 });
    }

    return NextResponse.json({ project: await saveDesignProject(session.user.id, project) });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
