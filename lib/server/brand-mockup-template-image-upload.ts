import "server-only";

import { deleteAdminMockupTemplateImageFile, saveAdminMockupTemplateImageBytes } from "@/lib/server/storage";
import type { UploadedFormFile } from "@/lib/server/uploaded-form-file";

const maxMockupTemplateImageBytes = 8 * 1024 * 1024;

type SupportedImageType = "image/png" | "image/jpeg";

export type BrandMockupTemplateImageUpload = {
  imageUrl: string;
  contentType: SupportedImageType;
  size: number;
};

export class BrandMockupTemplateImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function readImageType(contentType: string): SupportedImageType | undefined {
  return contentType === "image/png" || contentType === "image/jpeg" ? contentType : undefined;
}

function matchesMagicBytes(bytes: Uint8Array, contentType: SupportedImageType) {
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function saveBrandMockupTemplateImage(file: UploadedFormFile): Promise<BrandMockupTemplateImageUpload> {
  const contentType = readImageType(file.type);

  if (!contentType) {
    throw new BrandMockupTemplateImageUploadError("지원하지 않는 이미지 형식이에요.", 415);
  }

  if (file.size <= 0) {
    throw new BrandMockupTemplateImageUploadError("빈 파일은 업로드할 수 없어요.", 400);
  }

  if (file.size > maxMockupTemplateImageBytes) {
    throw new BrandMockupTemplateImageUploadError("목업 템플릿 이미지는 8MB 이하로 올려 주세요.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!matchesMagicBytes(bytes, contentType)) {
    throw new BrandMockupTemplateImageUploadError("파일 내용과 이미지 형식이 맞지 않아요.", 415);
  }

  const upload = await saveAdminMockupTemplateImageBytes(bytes, contentType);

  return {
    imageUrl: upload.publicUrl,
    contentType: upload.contentType,
    size: upload.size,
  };
}

export async function deleteBrandMockupTemplateImageFile(imageUrl: string) {
  return deleteAdminMockupTemplateImageFile(imageUrl);
}
