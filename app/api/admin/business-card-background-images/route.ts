import { NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { BackgroundImageUploadError, deleteBusinessCardBackgroundImageFile, saveBusinessCardBackgroundImage, type BusinessCardBackgroundImageUpload } from "@/lib/server/business-card-background-image-upload";
import { cleanupUnusedManagedBusinessCardBackgrounds, createManagedBusinessCardBackground, deleteManagedBusinessCardBackground, listManagedBusinessCardBackgroundsWithUsage, updateManagedBusinessCardBackground } from "@/lib/server/business-card-background-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBackgroundNameLength = 120;
const maxBackgroundTagLength = 40;
const maxBackgroundTags = 12;

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

function readTags(formData: FormData) {
  const tags: string[] = [];
  const values = formData.getAll("tags");

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    for (const tag of value.split(",")) {
      const trimmedTag = tag.trim();

      if (trimmedTag.length > 0 && trimmedTag.length <= maxBackgroundTagLength && !tags.includes(trimmedTag)) {
        tags.push(trimmedTag);
      }

      if (tags.length >= maxBackgroundTags) {
        return tags;
      }
    }
  }

  return tags;
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

function readJsonTags(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tags: string[] = [];

  for (const tag of value) {
    const trimmedTag = readOptionalJsonString(tag, maxBackgroundTagLength);

    if (trimmedTag && !tags.includes(trimmedTag)) {
      tags.push(trimmedTag);
    }

    if (tags.length >= maxBackgroundTags) {
      break;
    }
  }

  return tags;
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const backgrounds = await listManagedBusinessCardBackgroundsWithUsage();

  return NextResponse.json({ backgrounds });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const formData = await request.formData().catch(() => undefined);

  if (!formData) {
    return NextResponse.json({ reason: "이미지 업로드 요청이 올바르지 않아요." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ reason: "업로드할 이미지 파일을 선택해 주세요." }, { status: 400 });
  }

  let upload: BusinessCardBackgroundImageUpload | undefined;

  try {
    upload = await saveBusinessCardBackgroundImage(file);
    const background = await createManagedBusinessCardBackground({
      ...upload,
      name: readOptionalFormString(formData, "name", maxBackgroundNameLength) ?? readOptionalFormString(formData, "title", maxBackgroundNameLength) ?? file.name,
      tags: readTags(formData),
    });

    return NextResponse.json({ ...upload, background }, { status: 201 });
  } catch (error) {
    if (upload) {
      await deleteBusinessCardBackgroundImageFile(upload.imageUrl);
    }

    if (error instanceof BackgroundImageUploadError) {
      return NextResponse.json({ reason: error.message }, { status: error.status });
    }

    return NextResponse.json({ reason: "이미지를 업로드하지 못했어요." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);

  if (!isRecord(body) || typeof body.id !== "string") {
    return NextResponse.json({ reason: "수정할 배경 정보를 확인해 주세요." }, { status: 400 });
  }

  const background = await updateManagedBusinessCardBackground({
    id: body.id,
    name: readOptionalJsonString(body.name, maxBackgroundNameLength),
    tags: readJsonTags(body.tags),
  });

  if (!background) {
    return NextResponse.json({ reason: "배경 이미지를 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ background });
}

export async function DELETE(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const backgroundId = new URL(request.url).searchParams.get("id")?.trim();

  try {
    if (backgroundId) {
      const result = await deleteManagedBusinessCardBackground(backgroundId);

      if (result.status === "not-found") {
        return NextResponse.json({ reason: "배경 이미지를 찾지 못했어요." }, { status: 404 });
      }

      if (result.status === "used") {
        return NextResponse.json({ reason: "사용 중인 배경 이미지는 삭제할 수 없어요.", background: result.background }, { status: 409 });
      }

      return NextResponse.json({ deleted: true, background: result.background, deletedImageUrls: result.deletedImageUrls });
    }

    const result = await cleanupUnusedManagedBusinessCardBackgrounds();

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ reason: "사용하지 않는 배경 이미지를 정리하지 못했어요." }, { status: 500 });
  }
}
