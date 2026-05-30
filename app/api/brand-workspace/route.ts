import { NextResponse } from "next/server";
import { readBrandWorkspace } from "@/lib/brand-workspace";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { loadBrandWorkspace, saveBrandWorkspace, saveBrandWorkspacePatch } from "@/lib/server/brand-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const malformedWorkspaceResponse = { reason: "브랜드 작업 공간 형식이 올바르지 않아요." };
const malformedPatchResponse = { reason: "브랜드 작업 공간 패치 형식이 올바르지 않아요." };
const unavailableResponse = { reason: "브랜드 작업 공간을 사용할 수 없어요. 잠시 후 다시 시도해 주세요." };

function readHeaderValue(request: Request, name: string) {
  const value = request.headers.get(name);
  return value && value.trim() ? value.trim() : undefined;
}

function logBrandWorkspaceError(method: "GET" | "PUT", error: unknown) {
  console.error("Brand workspace request failed", { method, errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : "Unknown error" });
}

export async function GET() {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    return NextResponse.json(await loadBrandWorkspace(session.user.id));
  } catch (error) {
    logBrandWorkspaceError("GET", error);
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const startedAt = Date.now();
  const requestId = readHeaderValue(request, "x-printy-request-id") ?? undefined;
  const clientActionId = readHeaderValue(request, "x-printy-client-action-id") ?? undefined;

  try {
    const session = await getCurrentDbSession();
    const authenticatedAt = Date.now();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const raw = await request.text().catch(() => "");
    const payloadBytes = Buffer.byteLength(raw ?? "", "utf8");
    const body: unknown = raw
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const parsedAt = Date.now();

    if (typeof body === "object" && body !== null && "mode" in body && (body as { mode?: unknown }).mode === "patch") {
      const patch = (body as { patch?: unknown }).patch;

      if (!patch || typeof patch !== "object") {
        return NextResponse.json(malformedPatchResponse, { status: 400 });
      }

      const result = await saveBrandWorkspacePatch(session.user.id, patch);
      const completedAt = Date.now();

      console.info("Brand workspace patch saved", {
        requestId,
        clientActionId,
        authMs: authenticatedAt - startedAt,
        parseMs: parsedAt - authenticatedAt,
        saveMs: completedAt - parsedAt,
        totalMs: completedAt - startedAt,
        payloadBytes,
      });

      return NextResponse.json(result);
    }

    const workspace = readBrandWorkspace(body);

    if (!workspace) {
      return NextResponse.json(malformedWorkspaceResponse, { status: 400 });
    }

    const result = await saveBrandWorkspace(session.user.id, workspace);
    const completedAt = Date.now();

    console.info("Brand workspace saved", {
      requestId,
      clientActionId,
      authMs: authenticatedAt - startedAt,
      parseMs: parsedAt - authenticatedAt,
      saveMs: completedAt - parsedAt,
      totalMs: completedAt - startedAt,
      payloadBytes,
      brandCount: workspace.brands.length,
      draftCount: workspace.businessCardDrafts.length,
      printProductDraftCount: workspace.printProductDrafts.length,
      orderCount: workspace.orders.length,
      assetCount: workspace.brandAssets.length,
      savedGeneratedLogoCount: workspace.savedGeneratedLogoOptions.length,
    });

    return NextResponse.json(result);
  } catch (error) {
    logBrandWorkspaceError("PUT", error);
    console.error("Brand workspace save failed", {
      requestId,
      clientActionId,
      totalMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
