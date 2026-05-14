import { NextResponse } from "next/server";
import { generateBrandMockup } from "@/lib/server/brand-mockups";

export const runtime = "nodejs";

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

function isRateLimited(clientKey: string) {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }

  const bucket = rateLimitBuckets.get(clientKey);

  if (!bucket) {
    rateLimitBuckets.set(clientKey, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  if (bucket.count >= rateLimitMaxRequests) {
    return true;
  }

  bucket.count += 1;
  return false;
}

export async function POST(request: Request) {
  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json({ reason: "목업 생성 요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "목업 생성 요청이 올바르지 않아요." }, { status: 400 });
  }

  const brandId = readString(body, "brandId");
  const brandName = readString(body, "brandName");
  const category = readString(body, "category");
  const logoImageUrl = readString(body, "logoImageUrl");
  const sceneId = readString(body, "sceneId");

  if (!brandId || !brandName || !sceneId || !logoImageUrl.startsWith("/uploads/generated-logos/")) {
    return NextResponse.json({ reason: "저장된 로고 이미지가 있어야 목업을 만들 수 있어요." }, { status: 400 });
  }

  try {
    const asset = await generateBrandMockup({ brandId, brandName, category, logoImageUrl, sceneId });

    return NextResponse.json({ asset });
  } catch (error) {
    console.error("Brand mockup generation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: "브랜드 목업을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
