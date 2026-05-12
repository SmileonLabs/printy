import "server-only";

import { randomUUID } from "crypto";
import { deleteBusinessCardBackgroundImageFile, deleteOrphanBusinessCardBackgroundImages, type BusinessCardBackgroundImageUpload } from "@/lib/server/business-card-background-image-upload";
import { countReferencedAdminBusinessCardBackgroundImageUrls } from "@/lib/server/business-card-template-store";
import { queryDb, withDbClient } from "@/lib/server/db";

export type ManagedBusinessCardBackground = {
  id: string;
  name: string;
  tags: string[];
  imageUrl: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  size: number;
  createdAt: string;
  updatedAt: string;
};

export type ManagedBusinessCardBackgroundWithUsage = ManagedBusinessCardBackground & {
  used: boolean;
  usageCount: number;
};

type CleanupManagedBusinessCardBackgroundsResult = {
  deletedCount: number;
  deletedImageUrls: string[];
  deletedBackgrounds: ManagedBusinessCardBackground[];
};

const businessCardBackgroundImageUrlPattern = /^\/uploads\/admin\/business-card-backgrounds\/[a-f0-9-]+\.(png|jpg|webp)$/;
const maxBackgroundNameLength = 120;
const maxBackgroundTagLength = 40;
const maxBackgroundTags = 12;

type BusinessCardBackgroundRow = {
  id: string;
  name: string;
  tags: unknown;
  image_url: string;
  content_type: string;
  size: string | number;
  created_at: Date | string;
  updated_at: Date | string;
};

type ManagedBusinessCardBackgroundInput = BusinessCardBackgroundImageUpload & {
  name?: string;
  tags?: string[];
};

export type ManagedBusinessCardBackgroundPatch = {
  id: string;
  name?: string;
  tags?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: string[] = [];

  for (const tag of value) {
    const normalizedTag = readTrimmedString(tag, maxBackgroundTagLength);

    if (normalizedTag && !tags.includes(normalizedTag)) {
      tags.push(normalizedTag);
    }

    if (tags.length >= maxBackgroundTags) {
      break;
    }
  }

  return tags;
}

function isManagedBackgroundContentType(value: unknown): value is ManagedBusinessCardBackground["contentType"] {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp";
}

function normalizeManagedBackground(value: unknown): ManagedBusinessCardBackground | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readTrimmedString(value.id, 120);
  const name = readTrimmedString(value.name, maxBackgroundNameLength);
  const imageUrl = readTrimmedString(value.imageUrl, 2048);
  const createdAt = readTrimmedString(value.createdAt, 80);
  const updatedAt = readTrimmedString(value.updatedAt, 80);

  if (!id || !name || !imageUrl || !businessCardBackgroundImageUrlPattern.test(imageUrl) || !isManagedBackgroundContentType(value.contentType) || typeof value.size !== "number" || !Number.isFinite(value.size) || value.size <= 0 || !createdAt || !updatedAt) {
    return undefined;
  }

  return {
    id,
    name,
    tags: normalizeTags(value.tags),
    imageUrl,
    contentType: value.contentType,
    size: value.size,
    createdAt,
    updatedAt,
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toManagedBackground(row: BusinessCardBackgroundRow) {
  return normalizeManagedBackground({
    id: row.id,
    name: row.name,
    tags: row.tags,
    imageUrl: row.image_url,
    contentType: row.content_type,
    size: toNumber(row.size),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

function requireManagedBackground(row: BusinessCardBackgroundRow) {
  const background = toManagedBackground(row);

  if (!background) {
    throw new Error(`Invalid managed business-card background row: ${row.id}`);
  }

  return background;
}

async function listManagedBusinessCardBackgrounds() {
  const result = await queryDb<BusinessCardBackgroundRow>(
    `
      select id, name, tags, image_url, content_type, size, created_at, updated_at
      from business_card_backgrounds
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map(requireManagedBackground);
}

function withUsage(background: ManagedBusinessCardBackground, usageCounts: Map<string, number>): ManagedBusinessCardBackgroundWithUsage {
  const usageCount = usageCounts.get(background.imageUrl) ?? 0;

  return {
    ...background,
    used: usageCount > 0,
    usageCount,
  };
}

export async function listManagedBusinessCardBackgroundsWithUsage() {
  const backgrounds = await listManagedBusinessCardBackgrounds();
  const usageCounts = await countReferencedAdminBusinessCardBackgroundImageUrls();

  return backgrounds.map((background) => withUsage(background, usageCounts));
}

export async function createManagedBusinessCardBackground(input: ManagedBusinessCardBackgroundInput) {
  const result = await queryDb<BusinessCardBackgroundRow>(
    `
      insert into business_card_backgrounds (id, name, tags, image_url, content_type, size, uploaded_file_id)
      values ($1, $2, $3::jsonb, $4, $5, $6, (select id from uploaded_files where public_url = $4))
      returning id, name, tags, image_url, content_type, size, created_at, updated_at
    `,
    [`admin-business-card-background-${randomUUID()}`, readTrimmedString(input.name, maxBackgroundNameLength) ?? "Business card background", JSON.stringify(normalizeTags(input.tags)), input.imageUrl, input.contentType, input.size],
  );

  return requireManagedBackground(result.rows[0]);
}

export async function updateManagedBusinessCardBackground(input: ManagedBusinessCardBackgroundPatch) {
  const result = await queryDb<BusinessCardBackgroundRow>(
    `
      update business_card_backgrounds
      set name = coalesce($2, name),
        tags = coalesce($3::jsonb, tags),
        updated_at = now()
      where id = $1
      returning id, name, tags, image_url, content_type, size, created_at, updated_at
    `,
    [input.id, readTrimmedString(input.name, maxBackgroundNameLength) ?? null, input.tags ? JSON.stringify(normalizeTags(input.tags)) : null],
  );

  if (!result.rows[0]) {
    return undefined;
  }

  const nextBackground = requireManagedBackground(result.rows[0]);
  const usageCounts = await countReferencedAdminBusinessCardBackgroundImageUrls();

  return withUsage(nextBackground, usageCounts);
}

export async function deleteManagedBusinessCardBackground(backgroundId: string) {
  const result = await queryDb<BusinessCardBackgroundRow>(
    `
      select id, name, tags, image_url, content_type, size, created_at, updated_at
      from business_card_backgrounds
      where id = $1
    `,
    [backgroundId],
  );
  const background = result.rows[0] ? requireManagedBackground(result.rows[0]) : undefined;

  if (!background) {
    return { status: "not-found" as const };
  }

  const usageCounts = await countReferencedAdminBusinessCardBackgroundImageUrls();
  const usageCount = usageCounts.get(background.imageUrl) ?? 0;

  if (usageCount > 0) {
    return { status: "used" as const, background: withUsage(background, usageCounts) };
  }

  await queryDb("delete from business_card_backgrounds where id = $1", [backgroundId]);
  const deleted = await deleteBusinessCardBackgroundImageFile(background.imageUrl);

  return { status: "deleted" as const, background, deletedImageUrls: deleted ? [background.imageUrl] : [] };
}

export async function cleanupUnusedManagedBusinessCardBackgrounds(): Promise<CleanupManagedBusinessCardBackgroundsResult> {
  const backgrounds = await listManagedBusinessCardBackgrounds();
  const usageCounts = await countReferencedAdminBusinessCardBackgroundImageUrls();
  const deletedBackgrounds = backgrounds.filter((background) => (usageCounts.get(background.imageUrl) ?? 0) === 0);

  if (deletedBackgrounds.length > 0) {
    await withDbClient(async (client) => {
      await client.query("delete from business_card_backgrounds where id = any($1::text[])", [deletedBackgrounds.map((background) => background.id)]);
    });
  }

  const cleanupResult = await deleteOrphanBusinessCardBackgroundImages();

  return {
    deletedCount: cleanupResult.deletedCount,
    deletedImageUrls: cleanupResult.deletedImageUrls,
    deletedBackgrounds,
  };
}
