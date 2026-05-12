import "server-only";

import { randomUUID } from "crypto";
import { businessCardProductId, normalizeAdminBusinessCardTemplate, type BusinessCardTemplateInput, type BusinessCardTemplatePatch } from "@/lib/business-card-templates";
import { queryDb } from "@/lib/server/db";
import type { PrintTemplate } from "@/lib/types";

const businessCardBackgroundImageUrlPrefix = "/uploads/admin/business-card-backgrounds/";

type BusinessCardTemplateRow = {
  id: string;
  product_id: string;
  title: string;
  summary: string;
  tags: unknown;
  orientation: string;
  preview_variant: string | null;
  status: string;
  source: string;
  layout: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toTemplate(row: BusinessCardTemplateRow) {
  return normalizeAdminBusinessCardTemplate({
    id: row.id,
    productId: row.product_id,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    orientation: row.orientation,
    previewVariant: row.preview_variant ?? undefined,
    status: row.status,
    source: row.source,
    layout: row.layout ?? undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

function requireTemplate(row: BusinessCardTemplateRow) {
  const template = toTemplate(row);

  if (!template) {
    throw new Error(`Invalid admin business-card template row: ${row.id}`);
  }

  return template;
}

export async function listAdminBusinessCardTemplates() {
  const result = await queryDb<BusinessCardTemplateRow>(
    `
      select id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout, created_at, updated_at
      from business_card_templates
      where product_id = $1 and source = 'admin'
      order by updated_at desc, created_at desc
    `,
    [businessCardProductId],
  );

  return result.rows.map(requireTemplate);
}

export async function getAdminBusinessCardTemplate(templateId: string) {
  const result = await queryDb<BusinessCardTemplateRow>(
    `
      select id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout, created_at, updated_at
      from business_card_templates
      where id = $1 and product_id = $2 and source = 'admin'
    `,
    [templateId, businessCardProductId],
  );

  return result.rows[0] ? requireTemplate(result.rows[0]) : undefined;
}

function isBusinessCardBackgroundImageUrl(imageUrl: string) {
  if (!imageUrl.startsWith(businessCardBackgroundImageUrlPrefix)) {
    return false;
  }

  const fileName = imageUrl.slice(businessCardBackgroundImageUrlPrefix.length);

  return fileName.length > 0 && !fileName.includes("/") && !fileName.includes("\\");
}

export function collectReferencedAdminBusinessCardBackgroundImageUrls(templates: PrintTemplate[]) {
  const referencedImageUrls = new Set<string>();

  for (const template of templates) {
    if (!template.layout) {
      continue;
    }

    const frontBackground = template.layout.sides.front.background;
    const backBackground = template.layout.sides.back.background;

    if (frontBackground.enabled && frontBackground.type === "image" && isBusinessCardBackgroundImageUrl(frontBackground.imageUrl)) {
      referencedImageUrls.add(frontBackground.imageUrl);
    }

    if (backBackground.enabled && backBackground.type === "image" && isBusinessCardBackgroundImageUrl(backBackground.imageUrl)) {
      referencedImageUrls.add(backBackground.imageUrl);
    }
  }

  return referencedImageUrls;
}

export async function listReferencedAdminBusinessCardBackgroundImageUrls() {
  return collectReferencedAdminBusinessCardBackgroundImageUrls(await listAdminBusinessCardTemplates());
}

export function countReferencedAdminBusinessCardBackgroundImageUrls(templates: PrintTemplate[]): Map<string, number>;
export function countReferencedAdminBusinessCardBackgroundImageUrls(): Promise<Map<string, number>>;
export function countReferencedAdminBusinessCardBackgroundImageUrls(templates?: PrintTemplate[]) {
  function countReferencedImageUrls(resolvedTemplates: PrintTemplate[]) {
    const referencedImageUrls = new Map<string, number>();

    for (const template of resolvedTemplates) {
      if (!template.layout) {
        continue;
      }

      const frontBackground = template.layout.sides.front.background;
      const backBackground = template.layout.sides.back.background;

      if (frontBackground.enabled && frontBackground.type === "image" && isBusinessCardBackgroundImageUrl(frontBackground.imageUrl)) {
        referencedImageUrls.set(frontBackground.imageUrl, (referencedImageUrls.get(frontBackground.imageUrl) ?? 0) + 1);
      }

      if (backBackground.enabled && backBackground.type === "image" && isBusinessCardBackgroundImageUrl(backBackground.imageUrl)) {
        referencedImageUrls.set(backBackground.imageUrl, (referencedImageUrls.get(backBackground.imageUrl) ?? 0) + 1);
      }
    }

    return referencedImageUrls;
  }

  return templates ? countReferencedImageUrls(templates) : listAdminBusinessCardTemplates().then((resolvedTemplates) => countReferencedImageUrls(resolvedTemplates));
}

export async function createAdminBusinessCardTemplate(input: BusinessCardTemplateInput) {
  const result = await queryDb<BusinessCardTemplateRow>(
    `
      insert into business_card_templates (id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout)
      values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'admin', $9::jsonb)
      returning id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout, created_at, updated_at
    `,
    [`admin-template-${randomUUID()}`, businessCardProductId, input.title, input.summary, JSON.stringify(input.tags), input.orientation, input.previewVariant ?? null, input.status, input.layout ? JSON.stringify(input.layout) : null],
  );

  return requireTemplate(result.rows[0]);
}

export async function updateAdminBusinessCardTemplate(templateId: string, patch: BusinessCardTemplatePatch) {
  const currentTemplate = await getAdminBusinessCardTemplate(templateId);

  if (!currentTemplate) {
    return undefined;
  }

  const updatedTemplate: PrintTemplate = { ...currentTemplate, ...patch, id: currentTemplate.id, productId: businessCardProductId, source: "admin", createdAt: currentTemplate.createdAt };
  const normalizedTemplate = normalizeAdminBusinessCardTemplate(updatedTemplate);

  if (!normalizedTemplate) {
    throw new Error(`Invalid admin business-card template update: ${templateId}`);
  }

  const result = await queryDb<BusinessCardTemplateRow>(
    `
      update business_card_templates
      set title = $3,
        summary = $4,
        tags = $5::jsonb,
        orientation = $6,
        preview_variant = $7,
        status = $8,
        layout = $9::jsonb,
        updated_at = now()
      where id = $1 and product_id = $2 and source = 'admin'
      returning id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout, created_at, updated_at
    `,
    [templateId, businessCardProductId, normalizedTemplate.title, normalizedTemplate.summary, JSON.stringify(normalizedTemplate.tags), normalizedTemplate.orientation, normalizedTemplate.previewVariant ?? null, normalizedTemplate.status, normalizedTemplate.layout ? JSON.stringify(normalizedTemplate.layout) : null],
  );

  return result.rows[0] ? requireTemplate(result.rows[0]) : undefined;
}

export async function deleteAdminBusinessCardTemplate(templateId: string) {
  const result = await queryDb("delete from business_card_templates where id = $1 and product_id = $2 and source = 'admin'", [templateId, businessCardProductId]);

  return (result.rowCount ?? 0) > 0;
}

