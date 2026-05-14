import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { BrandMockupTemplateImageUploadError, deleteBrandMockupTemplateImageFile, saveBrandMockupTemplateImage } from "@/lib/server/brand-mockup-template-image-upload";
import { createBrandMockupTemplate, deleteBrandMockupTemplate, listAdminBrandMockupTemplates, normalizeBrandMockupTemplatePlacement, updateBrandMockupTemplate } from "@/lib/server/brand-mockup-template-store";
import { isUploadedFormFile, readUploadedFormFileName } from "@/lib/server/uploaded-form-file";
import type { BrandMockupTemplate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxTitleLength = 80;
const maxDescriptionLength = 240;

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function readOptionalFormString(formData: FormData, fieldName: string, maxLength: number) {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function readFormNumber(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function readFormPlacement(formData: FormData) {
  return normalizeBrandMockupTemplatePlacement({
    left: readFormNumber(formData, "left"),
    top: readFormNumber(formData, "top"),
    width: readFormNumber(formData, "width"),
    height: readFormNumber(formData, "height"),
    rotation: readFormNumber(formData, "rotation"),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalJsonString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function readStatus(value: unknown): BrandMockupTemplate["status"] | undefined {
  return value === "published" || value === "draft" ? value : undefined;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const templates = await listAdminBrandMockupTemplates();

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const formData = await request.formData().catch(() => undefined);

  if (!formData) {
    return NextResponse.json({ reason: "목업 템플릿 등록 요청이 올바르지 않아요." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!isUploadedFormFile(file)) {
    return NextResponse.json({ reason: "등록할 목업 사진을 선택해 주세요." }, { status: 400 });
  }

  let upload: Awaited<ReturnType<typeof saveBrandMockupTemplateImage>> | undefined;

  try {
    upload = await saveBrandMockupTemplateImage(file);
    const template = await createBrandMockupTemplate({
      ...upload,
      title: readOptionalFormString(formData, "title", maxTitleLength) ?? readUploadedFormFileName(file, "브랜드 목업 템플릿"),
      description: readOptionalFormString(formData, "description", maxDescriptionLength),
      placement: readFormPlacement(formData),
      status: readStatus(formData.get("status")) ?? "draft",
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (upload) {
      await deleteBrandMockupTemplateImageFile(upload.imageUrl);
    }

    if (error instanceof BrandMockupTemplateImageUploadError) {
      return NextResponse.json({ reason: error.message }, { status: error.status });
    }

    return NextResponse.json({ reason: "목업 템플릿을 등록하지 못했어요." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);

  if (!isRecord(body) || typeof body.id !== "string") {
    return NextResponse.json({ reason: "수정할 목업 템플릿을 확인해 주세요." }, { status: 400 });
  }

  const placement = isRecord(body.placement) ? normalizeBrandMockupTemplatePlacement(body.placement) : undefined;
  const template = await updateBrandMockupTemplate({
    id: body.id,
    title: readOptionalJsonString(body.title, maxTitleLength),
    description: readOptionalJsonString(body.description, maxDescriptionLength),
    placement,
    status: readStatus(body.status),
  });

  if (!template) {
    return NextResponse.json({ reason: "목업 템플릿을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ reason: "삭제할 목업 템플릿을 확인해 주세요." }, { status: 400 });
  }

  const template = await deleteBrandMockupTemplate(id);

  if (!template) {
    return NextResponse.json({ reason: "목업 템플릿을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, template });
}
