import { NextResponse } from "next/server";
import { analyzeLogoReferenceImage } from "@/lib/server/logo-reference-analysis";
import { listLogoReferenceImages, saveLogoReferenceImageBytes } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxReferenceImageSize = 5 * 1024 * 1024;
const uploadRateLimitWindowMs = 10 * 60 * 1000;
const uploadRateLimitMaxRequests = 3;
const uploadRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const unavailableResponse = { reason: "참고 이미지 저장소를 사용할 수 없어요. DATABASE_URL 설정과 DB 마이그레이션을 확인해 주세요." };

function readContentType(file: File): "image/png" | "image/jpeg" | undefined {
  return file.type === "image/png" || file.type === "image/jpeg" ? file.type : undefined;
}

function toReferenceImage(image: Awaited<ReturnType<typeof listLogoReferenceImages>>[number]) {
  return { id: image.id, name: image.name, imageUrl: image.publicUrl, contentType: image.contentType, size: image.size, createdAt: image.createdAt };
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

function isUploadRateLimited(clientKey: string) {
  const now = Date.now();

  for (const [key, bucket] of uploadRateLimitBuckets) {
    if (bucket.resetAt <= now) {
      uploadRateLimitBuckets.delete(key);
    }
  }

  const bucket = uploadRateLimitBuckets.get(clientKey);

  if (!bucket) {
    uploadRateLimitBuckets.set(clientKey, { count: 1, resetAt: now + uploadRateLimitWindowMs });
    return false;
  }

  if (bucket.count >= uploadRateLimitMaxRequests) {
    return true;
  }

  bucket.count += 1;
  return false;
}

export async function GET() {
  try {
    const images = await listLogoReferenceImages();

    return NextResponse.json({ images: images.map(toReferenceImage) });
  } catch (error) {
    console.warn("Logo reference image sync skipped", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ images: [] });
  }
}

export async function POST(request: Request) {
  if (isUploadRateLimited(getClientKey(request))) {
    return NextResponse.json({ reason: "참고 이미지 업로드 요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  const formData = await request.formData().catch(() => undefined);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ reason: "업로드할 참고 이미지를 선택해 주세요." }, { status: 400 });
  }

  const contentType = readContentType(file);

  if (!contentType) {
    return NextResponse.json({ reason: "PNG 또는 JPG 이미지만 등록할 수 있어요." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > maxReferenceImageSize) {
    return NextResponse.json({ reason: "참고 이미지는 5MB 이하로 등록해 주세요." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const analysis = await analyzeLogoReferenceImage(bytes, contentType, "user");
    const image = await saveLogoReferenceImageBytes(bytes, contentType, file.name, analysis);

    return NextResponse.json({ image: toReferenceImage(image) }, { status: 201 });
  } catch (error) {
    console.warn("Logo reference image upload failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
