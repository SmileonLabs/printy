import "server-only";

import { listReferencedAdminBusinessCardBackgroundImageUrls } from "@/lib/server/business-card-template-store";
import { deleteBusinessCardBackgroundFileByPublicUrl, deleteOrphanBusinessCardBackgroundFiles, saveBusinessCardBackgroundBytes } from "@/lib/server/storage";

const maxBackgroundImageBytes = 5 * 1024 * 1024;

type SupportedImageType = "image/png" | "image/jpeg";

export type BusinessCardBackgroundImageUpload = {
  imageUrl: string;
  contentType: SupportedImageType;
  size: number;
};

export type BusinessCardBackgroundImageCleanupResult = {
  deletedCount: number;
  deletedImageUrls: string[];
};

export class BackgroundImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function readImageType(contentType: string): SupportedImageType | undefined {
  if (contentType === "image/png" || contentType === "image/jpeg") {
    return contentType;
  }

  return undefined;
}

function matchesMagicBytes(bytes: Uint8Array, contentType: SupportedImageType) {
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return false;
}

export async function saveBusinessCardBackgroundImage(file: File): Promise<BusinessCardBackgroundImageUpload> {
  const contentType = readImageType(file.type);

  if (!contentType) {
    throw new BackgroundImageUploadError("지원하지 않는 이미지 형식이에요.", 415);
  }

  if (file.size <= 0) {
    throw new BackgroundImageUploadError("빈 파일은 업로드할 수 없어요.", 400);
  }

  if (file.size > maxBackgroundImageBytes) {
    throw new BackgroundImageUploadError("이미지는 5MB 이하로 올려 주세요.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!matchesMagicBytes(bytes, contentType)) {
    throw new BackgroundImageUploadError("파일 내용과 이미지 형식이 맞지 않아요.", 415);
  }

  const upload = await saveBusinessCardBackgroundBytes(bytes, contentType);

  return {
    imageUrl: upload.publicUrl,
    contentType: upload.contentType,
    size: upload.size,
  };
}

export async function deleteBusinessCardBackgroundImageFile(imageUrl: string) {
  return deleteBusinessCardBackgroundFileByPublicUrl(imageUrl);
}

export async function deleteOrphanBusinessCardBackgroundImages() {
  const referencedImageUrls = await listReferencedAdminBusinessCardBackgroundImageUrls();
  const deletedImageUrls = await deleteOrphanBusinessCardBackgroundFiles(referencedImageUrls);

  return {
    deletedCount: deletedImageUrls.length,
    deletedImageUrls,
  } satisfies BusinessCardBackgroundImageCleanupResult;
}
