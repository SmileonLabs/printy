import "server-only";

import { randomUUID } from "crypto";
import type { BrandMockupTemplate, BrandMockupTemplatePlacement } from "@/lib/types";
import { queryDb } from "@/lib/server/db";
import { deleteBrandMockupTemplateImageFile, type BrandMockupTemplateImageUpload } from "@/lib/server/brand-mockup-template-image-upload";

const maxTitleLength = 80;
const maxDescriptionLength = 240;

type BrandMockupTemplateRow = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  content_type: string;
  size: string | number;
  placement: unknown;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type BrandMockupTemplateInput = BrandMockupTemplateImageUpload & {
  title?: string;
  description?: string;
  placement?: BrandMockupTemplatePlacement;
  status?: BrandMockupTemplate["status"];
};

export type BrandMockupTemplatePatch = {
  id: string;
  title?: string;
  description?: string;
  placement?: BrandMockupTemplatePlacement;
  status?: BrandMockupTemplate["status"];
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

function clampPercent(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

export function normalizeBrandMockupTemplatePlacement(value: unknown): BrandMockupTemplatePlacement {
  if (!isRecord(value)) {
    return { left: 35, top: 35, width: 30, height: 18, rotation: 0 };
  }

  const left = typeof value.left === "number" ? value.left : 35;
  const top = typeof value.top === "number" ? value.top : 35;
  const width = typeof value.width === "number" ? value.width : 30;
  const height = typeof value.height === "number" ? value.height : 18;
  const rotation = typeof value.rotation === "number" && Number.isFinite(value.rotation) ? Math.min(45, Math.max(-45, value.rotation)) : 0;

  return {
    left: clampPercent(left, 35),
    top: clampPercent(top, 35),
    width: Math.max(5, clampPercent(width, 30)),
    height: Math.max(5, clampPercent(height, 18)),
    rotation,
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toBrandMockupTemplate(row: BrandMockupTemplateRow): BrandMockupTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    contentType: row.content_type === "image/png" ? "image/png" : "image/jpeg",
    size: toNumber(row.size),
    placement: normalizeBrandMockupTemplatePlacement(row.placement),
    status: row.status === "published" ? "published" : "draft",
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

export async function listAdminBrandMockupTemplates() {
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      select id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
      from brand_mockup_templates
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map(toBrandMockupTemplate);
}

export async function listPublishedBrandMockupTemplates() {
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      select id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
      from brand_mockup_templates
      where status = 'published'
      order by updated_at desc, created_at desc
    `,
  );

  return result.rows.map(toBrandMockupTemplate);
}

export async function getPublishedBrandMockupTemplate(id: string) {
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      select id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
      from brand_mockup_templates
      where id = $1 and status = 'published'
    `,
    [id],
  );

  return result.rows[0] ? toBrandMockupTemplate(result.rows[0]) : undefined;
}

export async function createBrandMockupTemplate(input: BrandMockupTemplateInput) {
  const title = readTrimmedString(input.title, maxTitleLength) ?? "브랜드 목업 템플릿";
  const description = readTrimmedString(input.description, maxDescriptionLength) ?? "관리자가 등록한 목업 사진에 로고를 합성해요.";
  const status = input.status === "published" ? "published" : "draft";
  const placement = normalizeBrandMockupTemplatePlacement(input.placement);
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      insert into brand_mockup_templates (id, title, description, image_url, content_type, size, placement, status, uploaded_file_id)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, (select id from uploaded_files where public_url = $4))
      returning id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
    `,
    [`brand-mockup-template-${randomUUID()}`, title, description, input.imageUrl, input.contentType, input.size, JSON.stringify(placement), status],
  );

  return toBrandMockupTemplate(result.rows[0]);
}

export async function updateBrandMockupTemplate(input: BrandMockupTemplatePatch) {
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      update brand_mockup_templates
      set title = coalesce($2, title),
        description = coalesce($3, description),
        placement = coalesce($4::jsonb, placement),
        status = coalesce($5, status),
        updated_at = now()
      where id = $1
      returning id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
    `,
    [input.id, readTrimmedString(input.title, maxTitleLength) ?? null, readTrimmedString(input.description, maxDescriptionLength) ?? null, input.placement ? JSON.stringify(normalizeBrandMockupTemplatePlacement(input.placement)) : null, input.status === "published" || input.status === "draft" ? input.status : null],
  );

  return result.rows[0] ? toBrandMockupTemplate(result.rows[0]) : undefined;
}

export async function deleteBrandMockupTemplate(id: string) {
  const result = await queryDb<BrandMockupTemplateRow>(
    `
      delete from brand_mockup_templates
      where id = $1
      returning id, title, description, image_url, content_type, size, placement, status, created_at, updated_at
    `,
    [id],
  );
  const deleted = result.rows[0] ? toBrandMockupTemplate(result.rows[0]) : undefined;

  if (!deleted) {
    return undefined;
  }

  await deleteBrandMockupTemplateImageFile(deleted.imageUrl);

  return deleted;
}
