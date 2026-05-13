import { NextResponse } from "next/server";
import { analyzeLogoReferenceImage } from "@/lib/server/logo-reference-analysis";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { deleteLogoReferenceImage, listLogoReferenceImages, saveLogoReferenceImageBytes, updateLogoReferenceImageForcedInstructions } from "@/lib/server/storage";
import { isUploadedFormFile, readUploadedFormFileName, type UploadedFormFile } from "@/lib/server/uploaded-form-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxReferenceImageSize = 5 * 1024 * 1024;

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readContentType(file: UploadedFormFile): "image/png" | "image/jpeg" | undefined {
  return file.type === "image/png" || file.type === "image/jpeg" ? file.type : undefined;
}

function toReferenceImage(image: Awaited<ReturnType<typeof listLogoReferenceImages>>[number]) {
  return { id: image.id, name: image.name, imageUrl: image.publicUrl, contentType: image.contentType, size: image.size, createdAt: image.createdAt, analysis: image.analysis };
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const images = await listLogoReferenceImages();

  return NextResponse.json({ images: images.map(toReferenceImage) });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const formData = await request.formData().catch(() => undefined);
  const file = formData?.get("file");

  if (!isUploadedFormFile(file)) {
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
  const analysis = await analyzeLogoReferenceImage(bytes, contentType, "admin");
  const image = await saveLogoReferenceImageBytes(bytes, contentType, readUploadedFormFileName(file, "reference-image"), analysis);

  return NextResponse.json({ image: toReferenceImage(image) }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json().catch(() => undefined);

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ reason: "수정할 로고 레퍼런스 정보를 확인해 주세요." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const imageId = typeof record.id === "string" ? record.id.trim() : "";
  const forcedInstructions = typeof record.forcedInstructions === "string" ? record.forcedInstructions.trim() : "";

  if (!imageId || forcedInstructions.length > 500) {
    return NextResponse.json({ reason: "강제사항은 500자 이하로 입력해 주세요." }, { status: 400 });
  }

  const image = await updateLogoReferenceImageForcedInstructions(imageId, forcedInstructions);

  if (!image) {
    return NextResponse.json({ reason: "참고 이미지를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ image: toReferenceImage(image) });
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const imageId = new URL(request.url).searchParams.get("id")?.trim();

  if (!imageId) {
    return NextResponse.json({ reason: "삭제할 참고 이미지를 선택해 주세요." }, { status: 400 });
  }

  const deleted = await deleteLogoReferenceImage(imageId);

  if (!deleted) {
    return NextResponse.json({ reason: "참고 이미지를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
