import "server-only";

import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PoolClient } from "pg";
import { queryDb, withDbClient } from "@/lib/server/db";
import type { LogoReferenceImageAnalysis } from "@/lib/types";

const businessCardBackgroundBucket = "admin-business-card-backgrounds";
const businessCardBackgroundPurpose = "business-card-background";
const uploadDirectory = path.join(process.cwd(), "public", "uploads", "admin", "business-card-backgrounds");
const publicUploadPath = "/uploads/admin/business-card-backgrounds";
const publicUploadPathPrefix = `${publicUploadPath}/`;
export const generatedLogoBucket = "generated-logos";
export const generatedLogoPurpose = "generated-logo";
export const generatedLogoUploadDirectory = path.join(process.cwd(), "data", "uploads", "generated-logos");
export const generatedLogoPublicPath = "/uploads/generated-logos";
const generatedLogoPublicPathPrefix = `${generatedLogoPublicPath}/`;
const logoReferenceBucket = "logo-reference-images";
const logoReferencePurpose = "logo-reference-image";
const logoReferenceUploadDirectory = path.join(process.cwd(), "data", "uploads", "logo-reference-images");
const logoReferencePublicPath = "/uploads/logo-reference-images";
const logoReferencePublicPathPrefix = `${logoReferencePublicPath}/`;
const brandAssetBucket = "brand-assets";
const brandAssetPurpose = "brand-asset";
const brandAssetUploadDirectory = path.join(process.cwd(), "data", "uploads", "brand-assets");
const brandAssetPublicPath = "/uploads/brand-assets";
const brandAssetPublicPathPrefix = `${brandAssetPublicPath}/`;

export type BusinessCardBackgroundStoredFile = {
  id: string;
  publicUrl: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  size: number;
};

type WritableBusinessCardBackgroundContentType = "image/png" | "image/jpeg";

export type GeneratedLogoStoredFile = {
  id: string;
  publicUrl: string;
  contentType: "image/png";
  size: number;
};

type UploadedFileRow = {
  id: string;
  object_key: string;
  public_url: string;
  content_type: string;
  size: string | number;
  created_at?: Date | string;
};

export type LogoReferenceImageStoredFile = {
  id: string;
  name: string;
  publicUrl: string;
  contentType: "image/png" | "image/jpeg";
  size: number;
  createdAt: string;
  analysis?: LogoReferenceImageAnalysis;
};

export type BrandAssetStoredFile = {
  id: string;
  publicUrl: string;
  contentType: "image/png";
  size: number;
};

type StaleGeneratedLogoUploadRow = {
  id: string;
  object_key: string;
  public_url: string;
  created_at: string;
};

type CleanupStaleUnreferencedGeneratedLogoUploadsOptions = {
  ageThresholdMs?: number;
  batchLimit?: number;
};

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isBusinessCardBackgroundObjectKey(objectKey: string) {
  return objectKey.length > 0 && !objectKey.includes("/") && !objectKey.includes("\\") && !objectKey.includes("..");
}

function isGeneratedLogoObjectKey(objectKey: string) {
  return /^[A-Za-z0-9_-]+\.png$/.test(objectKey) && !objectKey.includes("..");
}

function toPublicUrl(objectKey: string) {
  return `${publicUploadPathPrefix}${objectKey}`;
}

function objectKeyFromPublicUrl(publicUrl: string) {
  if (!publicUrl.startsWith(publicUploadPathPrefix)) {
    return undefined;
  }

  const objectKey = publicUrl.slice(publicUploadPathPrefix.length);

  return isBusinessCardBackgroundObjectKey(objectKey) ? objectKey : undefined;
}

function generatedLogoPublicUrlFromObjectKey(objectKey: string) {
  return `${generatedLogoPublicPathPrefix}${objectKey}`;
}

function generatedLogoObjectKeyFromPublicUrl(publicUrl: string) {
  if (!publicUrl.startsWith(generatedLogoPublicPathPrefix)) {
    return undefined;
  }

  const objectKey = publicUrl.slice(generatedLogoPublicPathPrefix.length);

  return isGeneratedLogoObjectKey(objectKey) ? objectKey : undefined;
}

function logoReferencePublicUrlFromObjectKey(objectKey: string) {
  return `${logoReferencePublicPathPrefix}${objectKey}`;
}

function logoReferenceObjectKeyFromPublicUrl(publicUrl: string) {
  if (!publicUrl.startsWith(logoReferencePublicPathPrefix)) {
    return undefined;
  }

  const objectKey = publicUrl.slice(logoReferencePublicPathPrefix.length);

  return isGeneratedLogoObjectKey(objectKey) || /^[A-Za-z0-9_-]+\.jpg$/.test(objectKey) ? objectKey : undefined;
}

function logoReferenceContentTypeFromObjectKey(objectKey: string): "image/png" | "image/jpeg" {
  return objectKey.endsWith(".png") ? "image/png" : "image/jpeg";
}

function brandAssetPublicUrlFromObjectKey(objectKey: string) {
  return `${brandAssetPublicPathPrefix}${objectKey}`;
}

function brandAssetObjectKeyFromPublicUrl(publicUrl: string) {
  if (!publicUrl.startsWith(brandAssetPublicPathPrefix)) {
    return undefined;
  }

  const objectKey = publicUrl.slice(brandAssetPublicPathPrefix.length);

  return isGeneratedLogoObjectKey(objectKey) ? objectKey : undefined;
}

function logoReferenceFileNameFromPublicUrl(publicUrl: string) {
  return logoReferenceObjectKeyFromPublicUrl(publicUrl);
}

function logoReferenceAnalysisPath(objectKey: string) {
  return path.join(logoReferenceUploadDirectory, `${objectKey}.analysis.json`);
}

function isLogoReferenceImageAnalysis(value: unknown): value is LogoReferenceImageAnalysis {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const status = record.status;
  const source = record.source;

  return (status === "ready" || status === "skipped" || status === "failed") && (source === "admin" || source === "user") && typeof record.summary === "string" && Array.isArray(record.styleTags) && record.styleTags.every((tag) => typeof tag === "string") && typeof record.colorNotes === "string" && typeof record.compositionNotes === "string" && typeof record.cautionNotes === "string" && (record.forcedInstructions === undefined || typeof record.forcedInstructions === "string") && typeof record.analyzedAt === "string" && (record.model === undefined || typeof record.model === "string");
}

async function writeLogoReferenceAnalysis(objectKey: string, analysis: LogoReferenceImageAnalysis | undefined) {
  if (!analysis) {
    return;
  }

  await writeFile(logoReferenceAnalysisPath(objectKey), JSON.stringify(analysis, null, 2));
}

async function writeFileCacheBestEffort(directory: string, filePath: string, bytes: Uint8Array, label: string) {
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, bytes);
  } catch (error) {
    console.warn(`${label} file cache write skipped`, { errorName: error instanceof Error ? error.name : "UnknownError" });
  }
}

async function writeLogoReferenceAnalysisBestEffort(objectKey: string, analysis: LogoReferenceImageAnalysis | undefined) {
  if (!analysis) {
    return;
  }

  try {
    await mkdir(logoReferenceUploadDirectory, { recursive: true });
    await writeLogoReferenceAnalysis(objectKey, analysis);
  } catch (error) {
    console.warn("Logo reference analysis cache write skipped", { errorName: error instanceof Error ? error.name : "UnknownError" });
  }
}

async function readLogoReferenceAnalysis(objectKey: string) {
  try {
    const raw = await readFile(logoReferenceAnalysisPath(objectKey), "utf8");
    const parsed: unknown = JSON.parse(raw);

    return isLogoReferenceImageAnalysis(parsed) ? normalizeLogoReferenceAnalysisForDisplay(parsed) : undefined;
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return undefined;
    }

    throw error;
  }
}

function hasKoreanText(value: string) {
  return /[가-힣]/.test(value);
}

function hasEnglishWords(value: string) {
  return /[A-Za-z]{3,}/.test(value);
}

function koreanAnalysisText(value: string, fallback: string) {
  return hasKoreanText(value) && !hasEnglishWords(value) ? value : fallback;
}

function normalizeLogoReferenceAnalysisForDisplay(analysis: LogoReferenceImageAnalysis): LogoReferenceImageAnalysis {
  const koreanStyleTags = analysis.styleTags.filter((tag) => hasKoreanText(tag) && !hasEnglishWords(tag));

  return {
    ...analysis,
    summary: koreanAnalysisText(analysis.summary, "이전 분석 데이터는 한국어 형식이 아니어서 새 한국어 분석 요약이 필요해요."),
    styleTags: koreanStyleTags,
    colorNotes: koreanAnalysisText(analysis.colorNotes, "색감 분석은 한국어로 다시 생성해야 해요."),
    compositionNotes: koreanAnalysisText(analysis.compositionNotes, "구도 분석은 한국어로 다시 생성해야 해요."),
    cautionNotes: koreanAnalysisText(analysis.cautionNotes, "원본 로고, 문자, 캐릭터, 고유 표식은 복제하지 않고 분위기만 참고해야 해요."),
  };
}

function extensionForContentType(contentType: WritableBusinessCardBackgroundContentType) {
  return contentType === "image/png" ? "png" : "jpg";
}

function logoReferenceExtensionForContentType(contentType: "image/png" | "image/jpeg") {
  return contentType === "image/png" ? "png" : "jpg";
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

async function writeUploadedFileBlob(uploadedFileId: string, bytes: Uint8Array) {
  await queryDb(
    `
      insert into uploaded_file_blobs (uploaded_file_id, bytes)
      values ($1, $2)
      on conflict (uploaded_file_id)
      do update set bytes = excluded.bytes, updated_at = now()
    `,
    [uploadedFileId, Buffer.from(bytes)],
  );
}

async function readUploadedFileBlob(bucket: string, purpose: string, objectKey: string): Promise<Uint8Array | undefined> {
  const result = await queryDb<{ bytes: Buffer }>(
    `
      select blob.bytes
      from uploaded_file_blobs blob
      join uploaded_files file on file.id = blob.uploaded_file_id
      where file.bucket = $1 and file.purpose = $2 and file.object_key = $3
    `,
    [bucket, purpose, objectKey],
  );
  const bytes = result.rows[0]?.bytes;

  return bytes ? new Uint8Array(bytes) : undefined;
}

async function uploadedFileBytesExist(bucket: string, purpose: string, objectKey: string, directory: string) {
  try {
    const stats = await stat(path.join(directory, objectKey));

    if (stats.isFile()) {
      return true;
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  return (await readUploadedFileBlob(bucket, purpose, objectKey)) !== undefined;
}

type BackgroundColor = {
  red: number;
  green: number;
  blue: number;
};

type PixelComponentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function colorDistance(a: BackgroundColor, b: BackgroundColor) {
  return Math.sqrt((a.red - b.red) ** 2 + (a.green - b.green) ** 2 + (a.blue - b.blue) ** 2);
}

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function readPixel(data: Buffer, pixelIndex: number) {
  const offset = pixelIndex * 4;
  return {
    red: data[offset] ?? 0,
    green: data[offset + 1] ?? 0,
    blue: data[offset + 2] ?? 0,
    alpha: data[offset + 3] ?? 0,
  };
}

function pixelLuminance({ red, green, blue }: BackgroundColor) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function isNearWhiteOpaquePixel(data: Buffer, pixelIndex: number) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && colorDistance({ red, green, blue }, { red: 255, green: 255, blue: 255 }) < 52;
}

function isDarkLogoPixel(data: Buffer, pixelIndex: number) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && pixelLuminance({ red, green, blue }) < 95;
}

function isNonWhiteOpaquePixel(data: Buffer, pixelIndex: number) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && colorDistance({ red, green, blue }, { red: 255, green: 255, blue: 255 }) > 72;
}

function estimateEdgeBackgroundColor(data: Buffer, width: number, height: number): BackgroundColor {
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();
  const addPixel = (pixelIndex: number) => {
    const { red, green, blue, alpha } = readPixel(data, pixelIndex);

    if (alpha < 180) {
      return;
    }

    const key = `${Math.round(red / 16)},${Math.round(green / 16)},${Math.round(blue / 16)}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  };

  for (let x = 0; x < width; x += 1) {
    addPixel(x);
    addPixel((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    addPixel(y * width);
    addPixel(y * width + width - 1);
  }

  const dominantBucket = Array.from(buckets.values()).sort((a, b) => b.count - a.count)[0];

  if (!dominantBucket) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: dominantBucket.red / dominantBucket.count,
    green: dominantBucket.green / dominantBucket.count,
    blue: dominantBucket.blue / dominantBucket.count,
  };
}

function isNearBackgroundPixel(data: Buffer, pixelIndex: number, backgroundColor: BackgroundColor) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return alpha > 40 && colorDistance({ red, green, blue }, backgroundColor) < 96 && maxChannel - minChannel <= 72;
}

function removeBackgroundMatteFromPixel(data: Buffer, pixelIndex: number, backgroundColor: BackgroundColor) {
  const offset = pixelIndex * 4;
  const { red, green, blue, alpha: currentAlpha } = readPixel(data, pixelIndex);
  const distanceFromBackground = colorDistance({ red, green, blue }, backgroundColor);

  if (distanceFromBackground < 32) {
    data[offset + 3] = 0;
    return true;
  }

  if (distanceFromBackground >= 150) {
    return false;
  }

  const alphaRatio = (distanceFromBackground - 32) / (150 - 32);
  const softenedAlphaRatio = Math.pow(Math.max(0, alphaRatio), 1.75);
  const nextAlpha = Math.min(currentAlpha, Math.max(0, Math.round(softenedAlphaRatio * currentAlpha)));
  data[offset + 3] = nextAlpha;

  if (nextAlpha > 0) {
    const normalizedAlpha = nextAlpha / 255;
    data[offset] = clampByte((red - backgroundColor.red * (1 - normalizedAlpha)) / normalizedAlpha);
    data[offset + 1] = clampByte((green - backgroundColor.green * (1 - normalizedAlpha)) / normalizedAlpha);
    data[offset + 2] = clampByte((blue - backgroundColor.blue * (1 - normalizedAlpha)) / normalizedAlpha);
  }

  return nextAlpha !== currentAlpha;
}

function softenPixelsNearTransparentBackground(data: Buffer, width: number, height: number, backgroundColor: BackgroundColor) {
  const alphaSnapshot = Buffer.alloc(width * height);
  for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    alphaSnapshot[pixel] = data[offset + 3] ?? 0;
  }

  let changedPixels = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const pixelIndex = y * width + x;
      const currentAlpha = alphaSnapshot[pixelIndex] ?? 0;

      if (currentAlpha === 0) {
        continue;
      }

      const minNeighborAlpha = Math.min(alphaSnapshot[pixelIndex - 1] ?? 255, alphaSnapshot[pixelIndex + 1] ?? 255, alphaSnapshot[pixelIndex - width] ?? 255, alphaSnapshot[pixelIndex + width] ?? 255);
      if (minNeighborAlpha >= 32) {
        continue;
      }

      const offset = pixelIndex * 4;
      const { red, green, blue } = readPixel(data, pixelIndex);
      if (colorDistance({ red, green, blue }, backgroundColor) >= 170) {
        continue;
      }

      changedPixels += removeBackgroundMatteFromPixel(data, pixelIndex, backgroundColor) ? 1 : 0;
    }
  }

  return changedPixels;
}

function shouldRemoveEnclosedWhiteComponent(data: Buffer, width: number, height: number, pixels: number[], bounds: PixelComponentBounds) {
  const area = pixels.length;
  const boxWidth = bounds.maxX - bounds.minX + 1;
  const boxHeight = bounds.maxY - bounds.minY + 1;
  const aspectRatio = boxWidth / Math.max(1, boxHeight);

  if (area < Math.max(2, width * height * 0.000005) || area > width * height * 0.015) {
    return false;
  }

  if (boxWidth > width * 0.18 || boxHeight > height * 0.15 || aspectRatio < 0.2 || aspectRatio > 5) {
    return false;
  }

  let borderPixels = 0;
  let darkBorderPixels = 0;
  let nonWhiteBorderPixels = 0;
  let transparentBorderPixels = 0;
  const inspectNeighbor = (neighborIndex: number) => {
    const alpha = data[neighborIndex * 4 + 3] ?? 0;

    if (alpha === 0) {
      transparentBorderPixels += 1;
      return;
    }

    borderPixels += 1;
    darkBorderPixels += isDarkLogoPixel(data, neighborIndex) ? 1 : 0;
    nonWhiteBorderPixels += isNonWhiteOpaquePixel(data, neighborIndex) ? 1 : 0;
  };

  for (const pixelIndex of pixels) {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (x > 0 && !isNearWhiteOpaquePixel(data, pixelIndex - 1)) inspectNeighbor(pixelIndex - 1);
    if (x < width - 1 && !isNearWhiteOpaquePixel(data, pixelIndex + 1)) inspectNeighbor(pixelIndex + 1);
    if (y > 0 && !isNearWhiteOpaquePixel(data, pixelIndex - width)) inspectNeighbor(pixelIndex - width);
    if (y < height - 1 && !isNearWhiteOpaquePixel(data, pixelIndex + width)) inspectNeighbor(pixelIndex + width);
  }

  if (borderPixels === 0 || transparentBorderPixels > 0 || nonWhiteBorderPixels / borderPixels <= 0.82) {
    return false;
  }

  const ringRadius = Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * 0.08));
  const startX = Math.max(0, bounds.minX - ringRadius);
  const endX = Math.min(width - 1, bounds.maxX + ringRadius);
  const startY = Math.max(0, bounds.minY - ringRadius);
  const endY = Math.min(height - 1, bounds.maxY + ringRadius);
  let ringPixels = 0;
  let opaqueRingPixels = 0;
  let darkRingPixels = 0;
  let nonWhiteRingPixels = 0;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        continue;
      }

      ringPixels += 1;
      const pixelIndex = y * width + x;
      const alpha = data[pixelIndex * 4 + 3] ?? 0;

      if (alpha === 0) {
        continue;
      }

      opaqueRingPixels += 1;
      darkRingPixels += isDarkLogoPixel(data, pixelIndex) ? 1 : 0;
      nonWhiteRingPixels += isNonWhiteOpaquePixel(data, pixelIndex) ? 1 : 0;
    }
  }

  return opaqueRingPixels > 0 && nonWhiteRingPixels / opaqueRingPixels > 0.7 && (darkRingPixels / Math.max(1, ringPixels) > 0.08 || nonWhiteRingPixels / Math.max(1, ringPixels) > 0.18);
}

function removeEnclosedWhiteComponents(data: Buffer, width: number, height: number) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  let removedPixels = 0;

  for (let startPixel = 0; startPixel < pixelCount; startPixel += 1) {
    if (visited[startPixel] || !isNearWhiteOpaquePixel(data, startPixel)) {
      continue;
    }

    const queue = [startPixel];
    const pixels: number[] = [];
    let bounds: PixelComponentBounds = { minX: width, minY: height, maxX: 0, maxY: 0 };
    visited[startPixel] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixelIndex = queue[cursor] ?? 0;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixels.push(pixelIndex);
      bounds = { minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y) };

      const enqueue = (neighborIndex: number) => {
        if (visited[neighborIndex] || !isNearWhiteOpaquePixel(data, neighborIndex)) {
          return;
        }

        visited[neighborIndex] = 1;
        queue.push(neighborIndex);
      };

      if (x > 0) enqueue(pixelIndex - 1);
      if (x < width - 1) enqueue(pixelIndex + 1);
      if (y > 0) enqueue(pixelIndex - width);
      if (y < height - 1) enqueue(pixelIndex + width);
    }

    if (!shouldRemoveEnclosedWhiteComponent(data, width, height, pixels, bounds)) {
      continue;
    }

    for (const pixelIndex of pixels) {
      data[pixelIndex * 4 + 3] = 0;
      removedPixels += 1;
    }
  }

  return removedPixels;
}

async function makeGeneratedLogoBackgroundTransparent(bytes: Uint8Array) {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixelCount = info.width * info.height;
    const backgroundColor = estimateEdgeBackgroundColor(data, info.width, info.height);
    const visited = new Uint8Array(pixelCount);
    const queue: number[] = [];
    let transparentPixels = 0;
    const enqueue = (pixelIndex: number) => {
      if (pixelIndex < 0 || pixelIndex >= pixelCount || visited[pixelIndex] || !isNearBackgroundPixel(data, pixelIndex, backgroundColor)) {
        return;
      }

      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    };

    for (let x = 0; x < info.width; x += 1) {
      enqueue(x);
      enqueue((info.height - 1) * info.width + x);
    }

    for (let y = 0; y < info.height; y += 1) {
      enqueue(y * info.width);
      enqueue(y * info.width + info.width - 1);
    }

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixelIndex = queue[cursor] ?? 0;
      const x = pixelIndex % info.width;
      const y = Math.floor(pixelIndex / info.width);

      data[pixelIndex * 4 + 3] = 0;
      transparentPixels += 1;

      if (x > 0) enqueue(pixelIndex - 1);
      if (x < info.width - 1) enqueue(pixelIndex + 1);
      if (y > 0) enqueue(pixelIndex - info.width);
      if (y < info.height - 1) enqueue(pixelIndex + info.width);
    }

    const softenedPixels = transparentPixels > 0 ? softenPixelsNearTransparentBackground(data, info.width, info.height, backgroundColor) : 0;
    const enclosedWhitePixels = removeEnclosedWhiteComponents(data, info.width, info.height);

    if (transparentPixels === 0 && softenedPixels === 0 && enclosedWhitePixels === 0) {
      return bytes;
    }

    return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  } catch (error) {
    console.warn("Generated logo background transparency skipped", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return bytes;
  }
}

function readStoredContentType(contentType: string): BusinessCardBackgroundStoredFile["contentType"] {
  if (contentType === "image/png" || contentType === "image/webp") {
    return contentType;
  }

  return "image/jpeg";
}

function toStoredFile(row: UploadedFileRow): BusinessCardBackgroundStoredFile {
  return {
    id: row.id,
    publicUrl: row.public_url,
    contentType: readStoredContentType(row.content_type),
    size: toNumber(row.size),
  };
}

export async function saveBusinessCardBackgroundBytes(bytes: Uint8Array, contentType: WritableBusinessCardBackgroundContentType): Promise<BusinessCardBackgroundStoredFile & { contentType: WritableBusinessCardBackgroundContentType }> {
  const id = `uploaded-file-${randomUUID()}`;
  const objectKey = `${randomUUID()}.${extensionForContentType(contentType)}`;
  const publicUrl = toPublicUrl(objectKey);
  const filePath = path.join(uploadDirectory, objectKey);
  const result = await queryDb<UploadedFileRow>(
    `
      insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, object_key, public_url, content_type, size
    `,
    [id, businessCardBackgroundBucket, objectKey, publicUrl, contentType, bytes.byteLength, businessCardBackgroundPurpose],
  );

  const row = result.rows[0];
  await writeUploadedFileBlob(row.id, bytes);
  await writeFileCacheBestEffort(uploadDirectory, filePath, bytes, "Business card background");

  return {
    id: row.id,
    publicUrl: row.public_url,
    contentType,
    size: toNumber(row.size),
  };
}

export async function readBusinessCardBackgroundBytesByFileName(fileName: string): Promise<{ bytes: Uint8Array; contentType: "image/png" | "image/jpeg" | "image/webp" } | undefined> {
  if (!isBusinessCardBackgroundObjectKey(fileName)) {
    return undefined;
  }

  try {
    const bytes = await readFile(path.join(uploadDirectory, fileName));

    return { bytes, contentType: readStoredContentType(fileName.endsWith(".png") ? "image/png" : fileName.endsWith(".webp") ? "image/webp" : "image/jpeg") };
  } catch (error) {
    if (isMissingFileError(error)) {
      const result = await queryDb<{ content_type: string }>(
        `
          select content_type
          from uploaded_files
          where bucket = $1 and purpose = $2 and object_key = $3
        `,
        [businessCardBackgroundBucket, businessCardBackgroundPurpose, fileName],
      );
      const bytes = await readUploadedFileBlob(businessCardBackgroundBucket, businessCardBackgroundPurpose, fileName);

      return bytes ? { bytes, contentType: readStoredContentType(result.rows[0]?.content_type ?? "image/jpeg") } : undefined;
    }

    throw error;
  }
}

export async function saveGeneratedLogoBytes(bytes: Uint8Array): Promise<GeneratedLogoStoredFile> {
  const logoBytes = await makeGeneratedLogoBackgroundTransparent(bytes);

  const id = `uploaded-file-${randomUUID()}`;
  const objectKey = `${randomUUID()}.png`;
  const publicUrl = generatedLogoPublicUrlFromObjectKey(objectKey);
  const filePath = path.join(generatedLogoUploadDirectory, objectKey);

  try {
    const result = await queryDb<UploadedFileRow>(
      `
        insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning id, object_key, public_url, content_type, size
      `,
      [id, generatedLogoBucket, objectKey, publicUrl, "image/png", logoBytes.byteLength, generatedLogoPurpose],
    );
    const row = result.rows[0];
    await writeUploadedFileBlob(row.id, logoBytes);
    await writeFileCacheBestEffort(generatedLogoUploadDirectory, filePath, logoBytes, "Generated logo");

    return {
      id: row.id,
      publicUrl: row.public_url,
      contentType: "image/png",
      size: toNumber(row.size),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Generated logo metadata registration skipped", { errorName: error instanceof Error ? error.name : "UnknownError" });

      return {
        id,
        publicUrl,
        contentType: "image/png",
        size: logoBytes.byteLength,
      };
    }

    throw error;
  }
}

export async function saveLogoReferenceImageBytes(bytes: Uint8Array, contentType: "image/png" | "image/jpeg", name: string, analysis?: LogoReferenceImageAnalysis): Promise<LogoReferenceImageStoredFile> {
  const id = `uploaded-file-${randomUUID()}`;
  const objectKey = `${randomUUID()}.${logoReferenceExtensionForContentType(contentType)}`;
  const publicUrl = logoReferencePublicUrlFromObjectKey(objectKey);
  const filePath = path.join(logoReferenceUploadDirectory, objectKey);
  const result = await queryDb<UploadedFileRow>(
    `
      insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, object_key, public_url, content_type, size, created_at
    `,
    [id, logoReferenceBucket, objectKey, publicUrl, contentType, bytes.byteLength, logoReferencePurpose],
  );
  const row = result.rows[0];
  await writeUploadedFileBlob(row.id, bytes);
  await writeFileCacheBestEffort(logoReferenceUploadDirectory, filePath, bytes, "Logo reference image");
  await writeLogoReferenceAnalysisBestEffort(objectKey, analysis);

  return {
    id: row.id,
    name,
    publicUrl: row.public_url,
    contentType,
    size: toNumber(row.size),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    analysis,
  };
}

export async function saveBrandAssetImageBytes(bytes: Uint8Array): Promise<BrandAssetStoredFile> {
  const id = `uploaded-file-${randomUUID()}`;
  const objectKey = `${randomUUID()}.png`;
  const publicUrl = brandAssetPublicUrlFromObjectKey(objectKey);
  const filePath = path.join(brandAssetUploadDirectory, objectKey);
  const result = await queryDb<UploadedFileRow>(
    `
      insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, object_key, public_url, content_type, size
    `,
    [id, brandAssetBucket, objectKey, publicUrl, "image/png", bytes.byteLength, brandAssetPurpose],
  );
  const row = result.rows[0];
  await writeUploadedFileBlob(row.id, bytes);
  await writeFileCacheBestEffort(brandAssetUploadDirectory, filePath, bytes, "Brand asset");

  return {
    id: row.id,
    publicUrl: row.public_url,
    contentType: "image/png",
    size: toNumber(row.size),
  };
}

export async function listLogoReferenceImages(): Promise<LogoReferenceImageStoredFile[]> {
  const result = await queryDb<UploadedFileRow>(
    `
      select id, object_key, public_url, content_type, size, created_at
      from uploaded_files
      where bucket = $1 and purpose = $2
      order by created_at desc
    `,
    [logoReferenceBucket, logoReferencePurpose],
  );

  const images = await Promise.all<LogoReferenceImageStoredFile | undefined>(
    result.rows.map(async (row): Promise<LogoReferenceImageStoredFile | undefined> => ((await uploadedFileBytesExist(logoReferenceBucket, logoReferencePurpose, row.object_key, logoReferenceUploadDirectory)) ? {
      id: row.id,
      name: row.object_key,
      publicUrl: row.public_url,
      contentType: row.content_type === "image/png" ? "image/png" : "image/jpeg",
      size: toNumber(row.size),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      analysis: await readLogoReferenceAnalysis(row.object_key),
    } : undefined)),
  );

  return images.filter((image): image is LogoReferenceImageStoredFile => image !== undefined);
}

export async function readLogoReferenceImageBytesById(id: string): Promise<{ bytes: Uint8Array; contentType: "image/png" | "image/jpeg"; analysis?: LogoReferenceImageAnalysis } | undefined> {
  const result = await queryDb<UploadedFileRow>(
    `select id, object_key, public_url, content_type, size from uploaded_files where id = $1 and bucket = $2 and purpose = $3`,
    [id, logoReferenceBucket, logoReferencePurpose],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  try {
    return { bytes: await readFile(path.join(logoReferenceUploadDirectory, row.object_key)), contentType: row.content_type === "image/png" ? "image/png" : "image/jpeg", analysis: await readLogoReferenceAnalysis(row.object_key) };
  } catch (error) {
    if (isMissingFileError(error)) {
      const bytes = await readUploadedFileBlob(logoReferenceBucket, logoReferencePurpose, row.object_key);

      return bytes ? { bytes, contentType: row.content_type === "image/png" ? "image/png" : "image/jpeg", analysis: await readLogoReferenceAnalysis(row.object_key) } : undefined;
    }

    throw error;
  }
}

export async function updateLogoReferenceImageForcedInstructions(id: string, forcedInstructions: string): Promise<LogoReferenceImageStoredFile | undefined> {
  const result = await queryDb<UploadedFileRow>(
    `select id, object_key, public_url, content_type, size, created_at from uploaded_files where id = $1 and bucket = $2 and purpose = $3`,
    [id, logoReferenceBucket, logoReferencePurpose],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  const currentAnalysis = await readLogoReferenceAnalysis(row.object_key);
  const nextAnalysis: LogoReferenceImageAnalysis = {
    status: currentAnalysis?.status ?? "skipped",
    source: currentAnalysis?.source ?? "admin",
    summary: currentAnalysis?.summary ?? "분석 데이터 없이 강제사항만 저장했어요.",
    styleTags: currentAnalysis?.styleTags ?? [],
    colorNotes: currentAnalysis?.colorNotes ?? "분석 데이터 없음",
    compositionNotes: currentAnalysis?.compositionNotes ?? "분석 데이터 없음",
    cautionNotes: currentAnalysis?.cautionNotes ?? "원본 로고/문자/고유 표식은 복제하지 않고 분위기만 참고해야 해요.",
    forcedInstructions: forcedInstructions.trim() || undefined,
    analyzedAt: currentAnalysis?.analyzedAt ?? new Date().toISOString(),
    model: currentAnalysis?.model,
  };

  await writeLogoReferenceAnalysis(row.object_key, nextAnalysis);

  return {
    id: row.id,
    name: row.object_key,
    publicUrl: row.public_url,
    contentType: row.content_type === "image/png" ? "image/png" : "image/jpeg",
    size: toNumber(row.size),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    analysis: nextAnalysis,
  };
}

export async function readLogoReferenceImageBytesByFileName(fileName: string): Promise<{ bytes: Uint8Array; contentType: "image/png" | "image/jpeg" } | undefined> {
  if (!logoReferenceFileNameFromPublicUrl(`${logoReferencePublicPathPrefix}${fileName}`)) {
    return undefined;
  }

  try {
    return { bytes: await readFile(path.join(logoReferenceUploadDirectory, fileName)), contentType: logoReferenceContentTypeFromObjectKey(fileName) };
  } catch (error) {
    if (isMissingFileError(error)) {
      const bytes = await readUploadedFileBlob(logoReferenceBucket, logoReferencePurpose, fileName);

      return bytes ? { bytes, contentType: logoReferenceContentTypeFromObjectKey(fileName) } : undefined;
    }

    throw error;
  }
}

export async function deleteLogoReferenceImage(id: string): Promise<boolean> {
  const result = await queryDb<UploadedFileRow>(
    `delete from uploaded_files where id = $1 and bucket = $2 and purpose = $3 returning object_key`,
    [id, logoReferenceBucket, logoReferencePurpose],
  );
  const objectKey = result.rows[0]?.object_key;

  if (!objectKey) {
    return false;
  }

  await unlink(path.join(logoReferenceUploadDirectory, objectKey)).catch(() => undefined);
  await unlink(logoReferenceAnalysisPath(objectKey)).catch(() => undefined);
  return true;
}

export function isGeneratedLogoPublicUrl(publicUrl: string) {
  return generatedLogoObjectKeyFromPublicUrl(publicUrl) !== undefined;
}

export async function readGeneratedLogoBytesByPublicUrl(publicUrl: string): Promise<Uint8Array | undefined> {
  const objectKey = generatedLogoObjectKeyFromPublicUrl(publicUrl);

  if (!objectKey) {
    return undefined;
  }

  try {
    return await readFile(path.join(generatedLogoUploadDirectory, objectKey));
  } catch (error) {
    if (isMissingFileError(error)) {
      return readUploadedFileBlob(generatedLogoBucket, generatedLogoPurpose, objectKey);
    }

    throw error;
  }
}

export function isBrandAssetPublicUrl(publicUrl: string) {
  return brandAssetObjectKeyFromPublicUrl(publicUrl) !== undefined;
}

export async function readBrandAssetBytesByPublicUrl(publicUrl: string): Promise<Uint8Array | undefined> {
  const objectKey = brandAssetObjectKeyFromPublicUrl(publicUrl);

  if (!objectKey) {
    return undefined;
  }

  try {
    return await readFile(path.join(brandAssetUploadDirectory, objectKey));
  } catch (error) {
    if (isMissingFileError(error)) {
      return readUploadedFileBlob(brandAssetBucket, brandAssetPurpose, objectKey);
    }

    throw error;
  }
}

async function isGeneratedLogoPublicUrlReferenced(publicUrl: string, client: Pick<PoolClient, "query">) {
  const result = await client.query<{ exists: boolean }>(
    "select exists (select 1 from generated_logos where payload->>'imageUrl' = $1) as exists",
    [publicUrl],
  );

  return result.rows[0]?.exists === true;
}

export async function deleteGeneratedLogoFileByPublicUrl(publicUrl: string): Promise<boolean> {
  const objectKey = generatedLogoObjectKeyFromPublicUrl(publicUrl);

  if (!objectKey) {
    return false;
  }

  return withDbClient(async (client) => {
    let transactionOpen = false;

    try {
      await client.query("begin");
      transactionOpen = true;

      const candidateResult = await client.query<UploadedFileRow>(
        `
          select id, object_key, public_url, content_type, size
          from uploaded_files
          where bucket = $1
            and purpose = $2
            and public_url = $3
            and object_key = $4
            and content_type = 'image/png'
            and size > 0
          for update
        `,
        [generatedLogoBucket, generatedLogoPurpose, publicUrl, objectKey],
      );
      const candidateRow = candidateResult.rows[0];
      const storedObjectKey = candidateRow?.object_key;

      if (!candidateRow || storedObjectKey !== objectKey || !isGeneratedLogoObjectKey(storedObjectKey)) {
        await client.query("rollback");
        transactionOpen = false;
        return false;
      }

      if (await isGeneratedLogoPublicUrlReferenced(publicUrl, client)) {
        await client.query("commit");
        transactionOpen = false;
        return false;
      }

      try {
        await unlink(path.join(generatedLogoUploadDirectory, storedObjectKey));
      } catch (error) {
        if (!isMissingFileError(error)) {
          await client.query("rollback");
          transactionOpen = false;
          throw error;
        }
      }

      const deleteResult = await client.query<{ id: string }>(
        `
          delete from uploaded_files
          where id = $1
            and bucket = $2
            and purpose = $3
            and public_url = $4
            and object_key = $5
            and content_type = 'image/png'
            and size > 0
            and not exists (
              select 1
              from generated_logos
              where payload->>'imageUrl' = $4
            )
          returning id
        `,
        [candidateRow.id, generatedLogoBucket, generatedLogoPurpose, publicUrl, storedObjectKey],
      );

      await client.query("commit");
      transactionOpen = false;

      return deleteResult.rows.length > 0;
    } catch (error) {
      if (transactionOpen) {
        await client.query("rollback");
      }

      throw error;
    }
  });
}

export async function assertGeneratedLogoStorageAvailableForPublicUrls(publicUrls: string[], client: Pick<PoolClient, "query">): Promise<void> {
  const uniquePublicUrls = Array.from(new Set(publicUrls.filter(isGeneratedLogoPublicUrl)));

  for (const publicUrl of uniquePublicUrls) {
    const objectKey = generatedLogoObjectKeyFromPublicUrl(publicUrl);

    if (!objectKey) {
      continue;
    }

    const metadataResult = await client.query<UploadedFileRow>(
      `
        select id, object_key, public_url, content_type, size
        from uploaded_files
        where bucket = $1
          and purpose = $2
          and public_url = $3
          and object_key = $4
          and content_type = 'image/png'
          and size > 0
        for key share
      `,
      [generatedLogoBucket, generatedLogoPurpose, publicUrl, objectKey],
    );

    if (metadataResult.rows.length === 0) {
      throw new Error("Generated logo storage is unavailable.");
    }

    let fileStats: Awaited<ReturnType<typeof stat>>;

    try {
      fileStats = await stat(path.join(generatedLogoUploadDirectory, objectKey));
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new Error("Generated logo storage is unavailable.");
      }

      throw error;
    }

    if (!fileStats.isFile() || fileStats.size <= 0) {
      throw new Error("Generated logo storage is unavailable.");
    }
  }
}

export async function cleanupUnreferencedGeneratedLogoFiles(publicUrls: string[]): Promise<{ deletedCount: number; deletedImageUrls: string[] }> {
  const deletedImageUrls: string[] = [];
  const uniquePublicUrls = Array.from(new Set(publicUrls.filter(isGeneratedLogoPublicUrl)));

  for (const publicUrl of uniquePublicUrls) {
    if (await deleteGeneratedLogoFileByPublicUrl(publicUrl)) {
      deletedImageUrls.push(publicUrl);
    }
  }

  return {
    deletedCount: deletedImageUrls.length,
    deletedImageUrls,
  };
}

export async function cleanupStaleUnreferencedGeneratedLogoUploads(options?: CleanupStaleUnreferencedGeneratedLogoUploadsOptions): Promise<{ deletedCount: number; deletedImageUrls: string[] }> {
  const ageThresholdMs = options?.ageThresholdMs ?? 24 * 60 * 60 * 1000;
  const batchLimit = options?.batchLimit ?? 25;
  const cutoffDate = new Date(Date.now() - ageThresholdMs);
  const result = await queryDb<StaleGeneratedLogoUploadRow>(
    `
      select id, object_key, public_url, created_at
      from uploaded_files
      where bucket = $1
        and purpose = $2
        and content_type = 'image/png'
        and size > 0
        and created_at < $3
        and not exists (
          select 1
          from generated_logos
          where payload->>'imageUrl' = uploaded_files.public_url
        )
      order by created_at asc
      limit $4
    `,
    [generatedLogoBucket, generatedLogoPurpose, cutoffDate, batchLimit],
  );
  const deletedImageUrls: string[] = [];

  for (const row of result.rows) {
    if (!isGeneratedLogoPublicUrl(row.public_url) || !isGeneratedLogoObjectKey(row.object_key)) {
      continue;
    }

    if (await deleteGeneratedLogoFileByPublicUrl(row.public_url)) {
      deletedImageUrls.push(row.public_url);
    }
  }

  return {
    deletedCount: deletedImageUrls.length,
    deletedImageUrls,
  };
}

export async function deleteBusinessCardBackgroundFileByPublicUrl(publicUrl: string) {
  const objectKey = objectKeyFromPublicUrl(publicUrl);

  if (!objectKey) {
    return false;
  }

  const result = await queryDb<UploadedFileRow>(
    `
      delete from uploaded_files
      where bucket = $1 and public_url = $2
      returning id, object_key, public_url, content_type, size
    `,
    [businessCardBackgroundBucket, publicUrl],
  );
  const storedObjectKey = result.rows[0]?.object_key ?? objectKey;

  if (!isBusinessCardBackgroundObjectKey(storedObjectKey)) {
    return false;
  }

  try {
    await unlink(path.join(uploadDirectory, storedObjectKey));

    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

export async function listOrphanBusinessCardBackgroundFileUrls(referencedPublicUrls: Set<string>) {
  let directoryEntries: Array<{ isFile(): boolean; name: string }>;

  try {
    directoryEntries = await readdir(uploadDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }

  const orphanPublicUrls: string[] = [];

  for (const entry of directoryEntries) {
    if (!entry.isFile() || !isBusinessCardBackgroundObjectKey(entry.name)) {
      continue;
    }

    const publicUrl = toPublicUrl(entry.name);

    if (!referencedPublicUrls.has(publicUrl)) {
      orphanPublicUrls.push(publicUrl);
    }
  }

  return orphanPublicUrls;
}

export async function deleteOrphanBusinessCardBackgroundFiles(referencedPublicUrls: Set<string>) {
  const orphanPublicUrls = await listOrphanBusinessCardBackgroundFileUrls(referencedPublicUrls);
  const deletedPublicUrls: string[] = [];

  for (const publicUrl of orphanPublicUrls) {
    if (await deleteBusinessCardBackgroundFileByPublicUrl(publicUrl)) {
      deletedPublicUrls.push(publicUrl);
    }
  }

  return deletedPublicUrls;
}

export async function registerExistingBusinessCardBackgroundFile(input: { publicUrl: string; contentType: "image/png" | "image/jpeg" | "image/webp"; size?: number }) {
  const objectKey = objectKeyFromPublicUrl(input.publicUrl);

  if (!objectKey) {
    return undefined;
  }

  const fileStats = input.size === undefined ? await stat(path.join(uploadDirectory, objectKey)).catch((error: unknown) => {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }) : undefined;
  const size = input.size ?? fileStats?.size;

  if (size === undefined || size <= 0) {
    return undefined;
  }

  const result = await queryDb<UploadedFileRow>(
    `
      insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (bucket, object_key)
      do update set
        public_url = excluded.public_url,
        content_type = excluded.content_type,
        size = excluded.size,
        purpose = excluded.purpose,
        updated_at = now()
      returning id, object_key, public_url, content_type, size
    `,
    [`uploaded-file-${randomUUID()}`, businessCardBackgroundBucket, objectKey, input.publicUrl, input.contentType, size, businessCardBackgroundPurpose],
  );

  return toStoredFile(result.rows[0]);
}
