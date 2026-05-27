import { NextResponse } from "next/server";
import { isBrandAsset, isPrintProductDraft } from "@/lib/brand-workspace";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { savePrintProductDraftPatch } from "@/lib/server/brand-workspace";
import type { BrandAsset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const malformedResponse = { reason: "저장할 인쇄물 디자인 형식이 올바르지 않아요." };
const unavailableResponse = { reason: "인쇄물 디자인을 저장하지 못했어요. 잠시 후 다시 시도해 주세요." };

function readPatchBody(body: unknown) {
  if (typeof body !== "object" || body === null || !("draft" in body)) {
    return undefined;
  }

  const { draft } = body;
  const assets = "assets" in body ? body.assets : [];

  if (!isPrintProductDraft(draft) || !Array.isArray(assets) || !assets.every(isBrandAsset)) {
    return undefined;
  }

  return { draft, assets: assets as BrandAsset[] };
}

export async function PUT(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const patch = readPatchBody(await request.json().catch(() => undefined));

    if (!patch) {
      return NextResponse.json(malformedResponse, { status: 400 });
    }

    return NextResponse.json(await savePrintProductDraftPatch(session.user.id, patch.draft, patch.assets));
  } catch (error) {
    console.error("Print product draft save failed", { errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
