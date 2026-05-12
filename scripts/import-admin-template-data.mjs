import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const businessCardProductId = "business-card";
const templateFilePath = path.join(process.cwd(), "data", "business-card-templates.json");
const backgroundFilePath = path.join(process.cwd(), "data", "business-card-backgrounds.json");
const backgroundImageUrlPattern = /^\/uploads\/admin\/business-card-backgrounds\/[a-f0-9-]+\.(png|jpg|webp)$/;
const templateStatuses = new Set(["draft", "published"]);
const previewVariants = new Set(["clean", "band", "editorial", "frame", "signal"]);
const orientations = new Set(["horizontal", "vertical"]);
const backgroundContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const fieldIds = ["role", "name", "phone", "email", "address", "mainPhone", "fax"];
const frontVisibleFieldIds = new Set(["role", "name", "phone", "email", "mainPhone", "fax"]);
const fontFamilies = new Set(["sans", "serif", "rounded", "mono", "display", "handwriting"]);
const textWeights = new Set(["regular", "bold"]);
const iconIds = new Set(["phone", "email", "location", "fax", "building", "web"]);
const defaultTextColor = "#111827";
const defaultIconColor = "#075dcb";
const defaultFields = fieldIds.map((id, index) => ({
  id,
  visible: frontVisibleFieldIds.has(id),
  box: [
    { x: 58, y: 21, width: 32, height: 10 },
    { x: 58, y: 33, width: 32, height: 12 },
    { x: 58, y: 55, width: 32, height: 8 },
    { x: 58, y: 66, width: 32, height: 8 },
    { x: 58, y: 77, width: 32, height: 8 },
    { x: 58, y: 44, width: 32, height: 8 },
    { x: 58, y: 88, width: 32, height: 8 },
  ][index],
  fontFamily: "sans",
  fontSize: 18,
  color: defaultTextColor,
  fontWeight: "bold",
  italic: false,
}));

function readString(value, maxLength) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function readDateString(value) {
  const dateString = readString(value, 80);

  if (!dateString) {
    return undefined;
  }

  const date = new Date(dateString);

  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function readTags(value, maxTagLength, maxTags, requireTags) {
  if (!Array.isArray(value)) {
    return requireTags ? undefined : [];
  }

  const tags = [];

  for (const tag of value) {
    const normalizedTag = readString(tag, maxTagLength);

    if (normalizedTag && !tags.includes(normalizedTag)) {
      tags.push(normalizedTag);
    }

    if (tags.length >= maxTags) {
      break;
    }
  }

  return requireTags && tags.length === 0 ? undefined : tags;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function readOptionalString(record, key) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readBox(value) {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
    return undefined;
  }

  if (value.x < 0 || value.y < 0 || value.width <= 0 || value.height <= 0 || value.x + value.width > 100 || value.y + value.height > 100) {
    return undefined;
  }

  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function containsBox(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function readCanvas(value) {
  if (!isRecord(value) || !isRecord(value.trim) || !isFiniteNumber(value.trim.widthMm) || !isFiniteNumber(value.trim.heightMm)) {
    return undefined;
  }

  const edit = readBox(value.edit);
  const safe = readBox(value.safe);

  if (!edit || !safe || value.trim.widthMm <= 0 || value.trim.heightMm <= 0 || !containsBox(edit, safe)) {
    return undefined;
  }

  return { trim: { widthMm: value.trim.widthMm, heightMm: value.trim.heightMm }, edit, safe };
}

function readBackground(value) {
  if (!isRecord(value) || typeof value.enabled !== "boolean") {
    return undefined;
  }

  if (!value.enabled) {
    return { enabled: false };
  }

  if ("color" in value && typeof value.color !== "string") {
    return undefined;
  }

  const color = readOptionalString(value, "color");
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl.trim() : "";

  if (value.type === "color") {
    return color ? { enabled: true, type: "color", color } : undefined;
  }

  if (value.type === "image" && imageUrl.length > 0 && imageUrl.length <= 2048 && /^(https?:\/\/|\/uploads\/admin\/business-card-backgrounds\/[a-f0-9-]+\.(png|jpg|webp)$)/.test(imageUrl)) {
    return color ? { enabled: true, type: "image", imageUrl, color } : { enabled: true, type: "image", imageUrl };
  }

  return undefined;
}

function readLogo(value) {
  if (!isRecord(value) || typeof value.visible !== "boolean") {
    return undefined;
  }

  const box = readBox(value.box);

  return box ? { visible: value.visible, box } : undefined;
}

function readSafeColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const color = value.trim();

  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

function readTextField(value) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.visible !== "boolean" || typeof value.fontFamily !== "string" || !isFiniteNumber(value.fontSize)) {
    return undefined;
  }

  const box = readBox(value.box);
  const fontWeight = typeof value.fontWeight === "string" && textWeights.has(value.fontWeight) ? value.fontWeight : "bold";
  const italic = typeof value.italic === "boolean" ? value.italic : false;

  if (!box || !fieldIds.includes(value.id) || !fontFamilies.has(value.fontFamily) || value.fontSize < 6 || value.fontSize > 36) {
    return undefined;
  }

  return { id: value.id, visible: value.visible, box, fontFamily: value.fontFamily, fontSize: value.fontSize, color: readSafeColor(value.color, defaultTextColor), fontWeight, italic };
}

function readFields(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalizedFields = value.map(readTextField);

  if (normalizedFields.some((field) => field === undefined)) {
    return undefined;
  }

  const fieldsById = new Map();

  for (const field of normalizedFields) {
    if (fieldsById.has(field.id)) {
      return undefined;
    }

    fieldsById.set(field.id, field);
  }

  return defaultFields.map((defaultField) => fieldsById.get(defaultField.id) ?? defaultField);
}

function readIcon(value) {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.icon !== "string" || typeof value.visible !== "boolean") {
    return undefined;
  }

  const id = value.id.trim();
  const box = readBox(value.box);

  if (!box || id.length === 0 || id.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(id) || !iconIds.has(value.icon)) {
    return undefined;
  }

  return { id, icon: value.icon, visible: value.visible, box, color: readSafeColor(value.color, defaultIconColor) };
}

function readIcons(value) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > 12) {
    return undefined;
  }

  const icons = value.map(readIcon);

  if (icons.some((icon) => icon === undefined)) {
    return undefined;
  }

  const iconElementIds = new Set();

  for (const icon of icons) {
    if (iconElementIds.has(icon.id)) {
      return undefined;
    }

    iconElementIds.add(icon.id);
  }

  return icons;
}

function readSideLayout(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const logo = readLogo(value.logo);
  const fields = readFields(value.fields);
  const icons = readIcons(value.icons);
  const background = readBackground(value.background);

  return logo && fields && icons && background ? { logo, fields, icons, background } : undefined;
}

function normalizeLayout(value) {
  if (!isRecord(value) || !isRecord(value.sides)) {
    return undefined;
  }

  const canvas = readCanvas(value.canvas);
  const front = readSideLayout(value.sides.front);
  const back = readSideLayout(value.sides.back);

  return canvas && front && back ? { canvas, sides: { front, back } } : undefined;
}

function normalizeTemplate(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value.id, 120);
  const title = readString(value.title, 80);
  const summary = readString(value.summary, 240);
  const tags = readTags(value.tags, 30, 12, true);
  const orientation = readString(value.orientation, 20);
  const previewVariant = readString(value.previewVariant, 40);
  const status = readString(value.status, 20);
  const createdAt = readDateString(value.createdAt);
  const updatedAt = readDateString(value.updatedAt) ?? createdAt;
  const layout = value.layout === undefined ? null : normalizeLayout(value.layout);

  if (!id || !title || !summary || !tags || !orientation || !orientations.has(orientation) || !status || !templateStatuses.has(status) || !createdAt || !updatedAt || value.productId !== businessCardProductId || value.source !== "admin") {
    return undefined;
  }

  if (previewVariant && !previewVariants.has(previewVariant)) {
    return undefined;
  }

  if (value.layout !== undefined && !layout) {
    return undefined;
  }

  return { id, productId: businessCardProductId, title, summary, tags, orientation, previewVariant, status, source: "admin", layout, createdAt, updatedAt };
}

function normalizeBackground(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value.id, 120);
  const name = readString(value.name, 120);
  const tags = readTags(value.tags, 40, 12, false);
  const imageUrl = readString(value.imageUrl, 2048);
  const contentType = readString(value.contentType, 40);
  const createdAt = readDateString(value.createdAt);
  const updatedAt = readDateString(value.updatedAt) ?? createdAt;

  if (!id || !name || !tags || !imageUrl || !backgroundImageUrlPattern.test(imageUrl) || !contentType || !backgroundContentTypes.has(contentType) || typeof value.size !== "number" || !Number.isFinite(value.size) || value.size <= 0 || !createdAt || !updatedAt) {
    return undefined;
  }

  return { id, name, tags, imageUrl, contentType, size: value.size, createdAt, updatedAt };
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function loadTemplates() {
  const payload = await readJsonIfPresent(templateFilePath);
  const templates = isRecord(payload) && Array.isArray(payload.templates) ? payload.templates : [];

  return templates.map(normalizeTemplate).filter((template) => template !== undefined);
}

async function loadBackgrounds() {
  const payload = await readJsonIfPresent(backgroundFilePath);
  const backgrounds = isRecord(payload) && Array.isArray(payload.backgrounds) ? payload.backgrounds : [];

  return backgrounds.map(normalizeBackground).filter((background) => background !== undefined);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[printy-db] DATABASE_URL is required to import admin template data.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

try {
  const [templates, backgrounds] = await Promise.all([loadTemplates(), loadBackgrounds()]);

  await client.connect();
  await client.query("begin");

  try {
    for (const template of templates) {
      await client.query(
        `
          insert into business_card_templates (id, product_id, title, summary, tags, orientation, preview_variant, status, source, layout, created_at, updated_at)
          values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::timestamptz, $12::timestamptz)
          on conflict (id)
          do update set
            product_id = excluded.product_id,
            title = excluded.title,
            summary = excluded.summary,
            tags = excluded.tags,
            orientation = excluded.orientation,
            preview_variant = excluded.preview_variant,
            status = excluded.status,
            source = excluded.source,
            layout = excluded.layout,
            created_at = least(business_card_templates.created_at, excluded.created_at),
            updated_at = greatest(business_card_templates.updated_at, excluded.updated_at)
        `,
        [template.id, template.productId, template.title, template.summary, JSON.stringify(template.tags), template.orientation, template.previewVariant ?? null, template.status, template.source, template.layout ? JSON.stringify(template.layout) : null, template.createdAt, template.updatedAt],
      );
    }

    for (const background of backgrounds) {
      await client.query(
        `
          insert into business_card_backgrounds (id, name, tags, image_url, content_type, size, created_at, updated_at)
          values ($1, $2, $3::jsonb, $4, $5, $6, $7::timestamptz, $8::timestamptz)
          on conflict (id)
          do update set
            name = excluded.name,
            tags = excluded.tags,
            image_url = excluded.image_url,
            content_type = excluded.content_type,
            size = excluded.size,
            created_at = least(business_card_backgrounds.created_at, excluded.created_at),
            updated_at = greatest(business_card_backgrounds.updated_at, excluded.updated_at)
        `,
        [background.id, background.name, JSON.stringify(background.tags), background.imageUrl, background.contentType, background.size, background.createdAt, background.updatedAt],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  console.log(`[printy-db] imported ${templates.length} admin business-card templates and ${backgrounds.length} managed backgrounds.`);
} finally {
  await client.end().catch(() => undefined);
}
