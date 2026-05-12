import { NextResponse } from "next/server";
import { isGeneratedLogoPublicUrl, readGeneratedLogoBytesByPublicUrl } from "@/lib/server/storage";
import { vectorizeGeneratedLogo } from "@/lib/server/logo-vectorizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readImageUrl(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const imageUrl = (value as { imageUrl?: unknown }).imageUrl;

  return typeof imageUrl === "string" && isGeneratedLogoPublicUrl(imageUrl) ? imageUrl : undefined;
}

export async function POST(request: Request) {
  const imageUrl = readImageUrl(await request.json().catch(() => undefined));

  if (!imageUrl) {
    return NextResponse.json({ reason: "변환할 로고 이미지를 찾을 수 없어요." }, { status: 400 });
  }

  const bytes = await readGeneratedLogoBytesByPublicUrl(imageUrl);

  if (!bytes) {
    return NextResponse.json({ reason: "로고 이미지 파일을 읽을 수 없어요." }, { status: 404 });
  }

  try {
    const svg = await vectorizeGeneratedLogo(bytes);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.warn("Logo SVG vectorization failed", { errorName: error instanceof Error ? error.name : "UnknownError", errorMessage: error instanceof Error ? error.message : undefined });
    return NextResponse.json({ reason: "SVG 변환에 실패했어요." }, { status: 422 });
  }
}
