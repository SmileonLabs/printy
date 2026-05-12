import type { BusinessCardTemplateBackground, BusinessCardTemplateBox, BusinessCardTemplateCanvas, BusinessCardTemplateFontFamily, BusinessCardTemplateIconElement, BusinessCardTemplateIconId, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateSideId, BusinessCardTemplateSideLayout, BusinessCardTemplateTextAlign, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId, BusinessCardTemplateTextWeight, PrintTemplate } from "@/lib/types";

export const businessCardProductId = "business-card";
export const businessCardTemplateStatuses = ["draft", "published"] as const;
export const businessCardTemplatePreviewVariants = ["clean", "band", "editorial", "frame", "signal"] as const;
export const businessCardTemplateFieldIds = ["role", "name", "phone", "email", "website", "address", "mainPhone", "fax"] as const;
export const businessCardTemplateFontFamilies = ["sans", "serif", "rounded", "mono", "display", "handwriting"] as const;
export const businessCardTemplateTextWeights = ["regular", "bold"] as const;
export const businessCardTemplateIconIds = ["phone", "email", "location", "fax", "building", "web"] as const;

export type BusinessCardTemplateIconArtwork = {
  viewBox: string;
  path: string;
};

export const businessCardTemplateIconArtwork: Record<BusinessCardTemplateIconId, BusinessCardTemplateIconArtwork> = {
  phone: { viewBox: "0 0 24 24", path: "M7.2 4.5 5.4 6.3c-.6.6-.8 1.5-.5 2.3 1.9 5.3 6.2 9.6 11.5 11.5.8.3 1.7.1 2.3-.5l1.8-1.8c.5-.5.5-1.4-.1-1.9l-2.6-2.1c-.5-.4-1.2-.4-1.7-.1l-1.4.9c-2.3-1.2-4.1-3-5.3-5.3l.9-1.4c.3-.5.3-1.2-.1-1.7L8.1 4.6c-.5-.6-1.4-.6-1.9-.1Z" },
  email: { viewBox: "0 0 24 24", path: "M4 6.8C4 5.8 4.8 5 5.8 5h12.4c1 0 1.8.8 1.8 1.8v10.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V6.8Zm2.2.5 5.1 4.1c.4.3 1 .3 1.4 0l5.1-4.1H6.2Zm11.6 9.4V9.8L14 12.9c-1.2 1-2.8 1-4 0L6.2 9.8v6.9h11.6Z" },
  location: { viewBox: "0 0 24 24", path: "M12 3.8c-3.4 0-6.2 2.7-6.2 6.1 0 4.5 5.2 9.5 5.7 10 .3.3.7.3 1 0 .6-.5 5.7-5.5 5.7-10 0-3.4-2.8-6.1-6.2-6.1Zm0 8.5a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z" },
  fax: { viewBox: "0 0 24 24", path: "M7 3.8h9.2c.8 0 1.4.6 1.4 1.4v4H7v-4c0-.8.6-1.4 1.4-1.4Zm-1.8 7h13.6c1 0 1.8.8 1.8 1.8V18c0 .8-.6 1.4-1.4 1.4h-2.1v-4.1H6.9v4.1H4.8c-.8 0-1.4-.6-1.4-1.4v-5.4c0-1 .8-1.8 1.8-1.8Zm3.4 6.1h6.8v3.3H8.6v-3.3Zm8.5-2.8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  building: { viewBox: "0 0 24 24", path: "M5 20.2V5.6c0-.9.7-1.6 1.6-1.6h7.8c.9 0 1.6.7 1.6 1.6v4.1h1.4c.9 0 1.6.7 1.6 1.6v8.9h-5v-4.1h-4v4.1H5Zm3-12.8v2h2v-2H8Zm0 4v2h2v-2H8Zm5-4v2h2v-2h-2Zm0 4v2h2v-2h-2Z" },
  web: { viewBox: "0 0 24 24", path: "M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Zm5.6 7.1h-3.1a12.5 12.5 0 0 0-1-4 5.9 5.9 0 0 1 4.1 4Zm-5.6-4.6c.4.7.8 2.2 1 4.6h-2c.2-2.4.6-3.9 1-4.6Zm-1.5.6a12.5 12.5 0 0 0-1 4H6.4a5.9 5.9 0 0 1 4.1-4Zm-4.1 6.2h3.1c.1 1.5.4 2.9 1 4a5.9 5.9 0 0 1-4.1-4Zm5.6 4.6c-.4-.7-.8-2.2-1-4.6h2c-.2 2.4-.6 3.9-1 4.6Zm1.5-.6c.6-1.1.9-2.5 1-4h3.1a5.9 5.9 0 0 1-4.1 4Z" },
};

export type BusinessCardTemplateStatus = (typeof businessCardTemplateStatuses)[number];
export type BusinessCardTemplatePreviewVariant = (typeof businessCardTemplatePreviewVariants)[number];
export type BusinessCardTemplateInput = {
  title: string;
  summary: string;
  tags: string[];
  orientation: "horizontal" | "vertical";
  previewVariant?: BusinessCardTemplatePreviewVariant;
  status: BusinessCardTemplateStatus;
  layout?: BusinessCardTemplateLayout;
};

export type BusinessCardTemplatePatch = Partial<BusinessCardTemplateInput>;

const maxTitleLength = 80;
const maxSummaryLength = 240;
const maxTagLength = 30;
const maxTags = 12;
const minFontSize = 6;
const maxFontSize = 36;
const maxImageUrlLength = 2048;
const defaultTextColor = "#111827";
const defaultIconColor = "#075dcb";
const defaultLineColor = "#111827";
const maxIconElements = 12;
const maxLineElements = 12;
const maxElementIdLength = 80;
const maxIconTextGapPx = 80;

const frontVisibleTextFieldIds = new Set<BusinessCardTemplateTextFieldId>(["role", "name", "phone", "email", "website", "mainPhone", "fax"]);

const defaultBusinessCardTextElements: BusinessCardTemplateTextElement[] = businessCardTemplateFieldIds.map((id, index) => ({
  id,
  visible: frontVisibleTextFieldIds.has(id),
  box: [
    { x: 58, y: 21, width: 32, height: 10 },
    { x: 58, y: 33, width: 32, height: 12 },
    { x: 58, y: 55, width: 32, height: 8 },
    { x: 58, y: 66, width: 32, height: 8 },
    { x: 58, y: 77, width: 32, height: 8 },
    { x: 58, y: 88, width: 32, height: 8 },
    { x: 58, y: 44, width: 32, height: 8 },
    { x: 58, y: 88, width: 32, height: 8 },
  ][index],
  fontFamily: "sans",
  fontSize: 18,
  color: defaultTextColor,
  fontWeight: "bold",
  italic: false,
  align: "left",
}));

const defaultBusinessCardIconElements: BusinessCardTemplateIconElement[] = [];

const defaultBusinessCardBackTextElements: BusinessCardTemplateTextElement[] = defaultBusinessCardTextElements.map((field) => ({ ...field, visible: false, box: { ...field.box } }));

const defaultBusinessCardSideLayout: BusinessCardTemplateSideLayout = {
  logo: { visible: true, box: { x: 12, y: 28, width: 26, height: 26 } },
  fields: defaultBusinessCardTextElements,
  icons: defaultBusinessCardIconElements,
  lines: [],
  background: { enabled: false },
};

export const defaultBusinessCardTemplateLayout: BusinessCardTemplateLayout = {
  canvas: {
    trim: { widthMm: 90, heightMm: 50 },
    edit: { x: 1.087, y: 1.923, width: 97.826, height: 96.154 },
    safe: { x: 3.261, y: 5.769, width: 93.478, height: 88.462 },
  },
  sides: {
    front: defaultBusinessCardSideLayout,
    back: {
      logo: { visible: true, box: { x: 37, y: 25, width: 26, height: 26 } },
      fields: defaultBusinessCardBackTextElements,
      icons: [],
      lines: [],
      background: { enabled: false },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readTrimmedString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

function readOptionalTrimmedString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" && field.trim().length > 0 ? field.trim() : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBusinessCardTemplateTextFieldId(value: string): value is BusinessCardTemplateTextFieldId {
  return businessCardTemplateFieldIds.includes(value as BusinessCardTemplateTextFieldId);
}

function isBusinessCardTemplateFontFamily(value: string): value is BusinessCardTemplateFontFamily {
  return businessCardTemplateFontFamilies.includes(value as BusinessCardTemplateFontFamily);
}

function isBusinessCardTemplateTextWeight(value: string): value is BusinessCardTemplateTextWeight {
  return businessCardTemplateTextWeights.includes(value as BusinessCardTemplateTextWeight);
}

function isBusinessCardTemplateTextAlign(value: string): value is BusinessCardTemplateTextAlign {
  return value === "left" || value === "center" || value === "right";
}

function isBusinessCardTemplateIconId(value: string): value is BusinessCardTemplateIconId {
  return businessCardTemplateIconIds.includes(value as BusinessCardTemplateIconId);
}

function isBusinessCardTemplateStatus(value: string): value is BusinessCardTemplateStatus {
  return businessCardTemplateStatuses.includes(value as BusinessCardTemplateStatus);
}

function isBusinessCardTemplatePreviewVariant(value: string): value is BusinessCardTemplatePreviewVariant {
  return businessCardTemplatePreviewVariants.includes(value as BusinessCardTemplatePreviewVariant);
}

function readTags(value: Record<string, unknown>) {
  const tags = value.tags;

  if (!Array.isArray(tags)) {
    return undefined;
  }

  const normalizedTags = tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter((tag, index, allTags) => tag.length > 0 && tag.length <= maxTagLength && allTags.indexOf(tag) === index);

  return normalizedTags.length > 0 && normalizedTags.length <= maxTags ? normalizedTags : undefined;
}

function readBox(value: unknown): BusinessCardTemplateBox | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
    return undefined;
  }

  if (value.x < 0 || value.y < 0 || value.width <= 0 || value.height <= 0 || value.x + value.width > 100 || value.y + value.height > 100) {
    return undefined;
  }

  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function containsBox(outer: BusinessCardTemplateBox, inner: BusinessCardTemplateBox) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function readCanvas(value: unknown): BusinessCardTemplateCanvas | undefined {
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

function readBackground(value: unknown): BusinessCardTemplateBackground | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean") {
    return undefined;
  }

  if (!value.enabled) {
    return { enabled: false };
  }

  if ("color" in value && typeof value.color !== "string") {
    return undefined;
  }

  const color = readOptionalTrimmedString(value, "color");
  const imageUrl = readTrimmedString(value, "imageUrl");

  if (value.type === "color") {
    return color ? { enabled: true, type: "color", color } : undefined;
  }

  if (value.type === "image" && imageUrl.length > 0 && imageUrl.length <= maxImageUrlLength && /^(https?:\/\/|\/uploads\/admin\/business-card-backgrounds\/[a-f0-9-]+\.(png|jpg|webp)$)/.test(imageUrl)) {
    return color ? { enabled: true, type: "image", imageUrl, color } : { enabled: true, type: "image", imageUrl };
  }

  return undefined;
}

function readLogo(value: unknown) {
  if (!isRecord(value) || typeof value.visible !== "boolean") {
    return undefined;
  }

  const box = readBox(value.box);

  return box ? { visible: value.visible, box } : undefined;
}

function readSafeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const color = value.trim();

  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

function readTextField(value: unknown): BusinessCardTemplateTextElement | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.visible !== "boolean" || typeof value.fontFamily !== "string" || !isFiniteNumber(value.fontSize)) {
    return undefined;
  }

  const box = readBox(value.box);
  const fontWeight = typeof value.fontWeight === "string" && isBusinessCardTemplateTextWeight(value.fontWeight) ? value.fontWeight : "bold";
  const italic = typeof value.italic === "boolean" ? value.italic : false;
  const align = typeof value.align === "string" && isBusinessCardTemplateTextAlign(value.align) ? value.align : "left";
  const customValue = typeof value.customValue === "string" && value.customValue.trim().length > 0 && value.customValue.length <= 240 ? value.customValue.trim() : undefined;

  if (!box || !isBusinessCardTemplateTextFieldId(value.id) || !isBusinessCardTemplateFontFamily(value.fontFamily) || value.fontSize < minFontSize || value.fontSize > maxFontSize) {
    return undefined;
  }

  return customValue ? { id: value.id, visible: value.visible, box, fontFamily: value.fontFamily, fontSize: value.fontSize, color: readSafeColor(value.color, defaultTextColor), fontWeight, italic, align, customValue } : { id: value.id, visible: value.visible, box, fontFamily: value.fontFamily, fontSize: value.fontSize, color: readSafeColor(value.color, defaultTextColor), fontWeight, italic, align };
}

function readFields(value: unknown, sideId: BusinessCardTemplateSideId) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const fields = value.map(readTextField);

  if (fields.some((field) => field === undefined)) {
    return undefined;
  }

  const normalizedFields = fields.filter((field): field is BusinessCardTemplateTextElement => field !== undefined);
  const fieldsById = new Map<BusinessCardTemplateTextFieldId, BusinessCardTemplateTextElement>();

  for (const field of normalizedFields) {
    if (fieldsById.has(field.id)) {
      return undefined;
    }

    fieldsById.set(field.id, field);
  }

  const defaultFields = sideId === "back" ? defaultBusinessCardBackTextElements : defaultBusinessCardTextElements;

  return defaultFields.map((defaultField) => fieldsById.get(defaultField.id) ?? defaultField);
}

function readIconElement(value: unknown): BusinessCardTemplateIconElement | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.icon !== "string" || typeof value.visible !== "boolean") {
    return undefined;
  }

  const id = value.id.trim();
  const box = readBox(value.box);

  if (!box || id.length === 0 || id.length > maxElementIdLength || !/^[a-zA-Z0-9_-]+$/.test(id) || !isBusinessCardTemplateIconId(value.icon)) {
    return undefined;
  }

  const textGapPx = isFiniteNumber(value.textGapPx) && value.textGapPx >= 0 && value.textGapPx <= maxIconTextGapPx ? Number(value.textGapPx.toFixed(2)) : undefined;
  const icon = { id, icon: value.icon, visible: value.visible, box, color: readSafeColor(value.color, defaultIconColor) };

  return textGapPx === undefined ? icon : { ...icon, textGapPx };
}

function readIcons(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > maxIconElements) {
    return undefined;
  }

  const icons = value.map(readIconElement);

  if (icons.some((icon) => icon === undefined)) {
    return undefined;
  }

  const normalizedIcons = icons.filter((icon): icon is BusinessCardTemplateIconElement => icon !== undefined);
  const iconIds = new Set<string>();

  for (const icon of normalizedIcons) {
    if (iconIds.has(icon.id)) {
      return undefined;
    }

    iconIds.add(icon.id);
  }

  return normalizedIcons;
}

function readLineElement(value: unknown): BusinessCardTemplateLineElement | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.orientation !== "string" || typeof value.visible !== "boolean") {
    return undefined;
  }

  const id = value.id.trim();
  const box = readBox(value.box);

  if (!box || id.length === 0 || id.length > maxElementIdLength || !/^[a-zA-Z0-9_-]+$/.test(id) || (value.orientation !== "horizontal" && value.orientation !== "vertical")) {
    return undefined;
  }

  return { id, orientation: value.orientation, visible: value.visible, box, color: readSafeColor(value.color, defaultLineColor) };
}

function readLines(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > maxLineElements) {
    return undefined;
  }

  const lines = value.map(readLineElement);

  if (lines.some((line) => line === undefined)) {
    return undefined;
  }

  const normalizedLines = lines.filter((line): line is BusinessCardTemplateLineElement => line !== undefined);
  const lineIds = new Set<string>();

  for (const line of normalizedLines) {
    if (lineIds.has(line.id)) {
      return undefined;
    }

    lineIds.add(line.id);
  }

  return normalizedLines;
}

function readSideLayout(value: unknown, sideId: BusinessCardTemplateSideId): BusinessCardTemplateSideLayout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const logo = readLogo(value.logo);
  const fields = readFields(value.fields, sideId);
  const icons = readIcons(value.icons);
  const lines = readLines(value.lines);
  const background = readBackground(value.background);

  return logo && fields && icons && lines && background ? { logo, fields, icons, lines, background } : undefined;
}

export function normalizeBusinessCardTemplateLayout(value: unknown): BusinessCardTemplateLayout | undefined {
  if (!isRecord(value) || !isRecord(value.sides)) {
    return undefined;
  }

  const canvas = readCanvas(value.canvas);
  const front = readSideLayout(value.sides.front, "front");
  const back = readSideLayout(value.sides.back, "back");

  return canvas && front && back ? { canvas, sides: { front, back } } : undefined;
}

export function parseBusinessCardTemplateInput(value: unknown): BusinessCardTemplateInput | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const title = readTrimmedString(value, "title");
  const summary = readTrimmedString(value, "summary");
  const tags = readTags(value);
  const orientation = readTrimmedString(value, "orientation");
  const previewVariantValue = readOptionalTrimmedString(value, "previewVariant");
  const status = readOptionalTrimmedString(value, "status") ?? "draft";
  const layout = "layout" in value ? normalizeBusinessCardTemplateLayout(value.layout) : undefined;

  if (title.length === 0 || title.length > maxTitleLength || summary.length === 0 || summary.length > maxSummaryLength || !tags) {
    return undefined;
  }

  if (orientation !== "horizontal" && orientation !== "vertical") {
    return undefined;
  }

  if (!isBusinessCardTemplateStatus(status)) {
    return undefined;
  }

  if ("layout" in value && !layout) {
    return undefined;
  }

  let previewVariant: BusinessCardTemplatePreviewVariant | undefined;

  if (previewVariantValue) {
    if (!isBusinessCardTemplatePreviewVariant(previewVariantValue)) {
      return undefined;
    }

    previewVariant = previewVariantValue;
  }

  return { title, summary, tags, orientation, previewVariant, status, layout };
}

export function parseBusinessCardTemplatePatch(value: unknown): BusinessCardTemplatePatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const patch: BusinessCardTemplatePatch = {};

  if ("title" in value) {
    const title = readTrimmedString(value, "title");

    if (title.length === 0 || title.length > maxTitleLength) {
      return undefined;
    }

    patch.title = title;
  }

  if ("summary" in value) {
    const summary = readTrimmedString(value, "summary");

    if (summary.length === 0 || summary.length > maxSummaryLength) {
      return undefined;
    }

    patch.summary = summary;
  }

  if ("tags" in value) {
    const tags = readTags(value);

    if (!tags) {
      return undefined;
    }

    patch.tags = tags;
  }

  if ("orientation" in value) {
    const orientation = readTrimmedString(value, "orientation");

    if (orientation !== "horizontal" && orientation !== "vertical") {
      return undefined;
    }

    patch.orientation = orientation;
  }

  if ("previewVariant" in value) {
    const previewVariantValue = readOptionalTrimmedString(value, "previewVariant");

    if (previewVariantValue) {
      if (!isBusinessCardTemplatePreviewVariant(previewVariantValue)) {
        return undefined;
      }

      patch.previewVariant = previewVariantValue;
    } else {
      patch.previewVariant = undefined;
    }
  }

  if ("status" in value) {
    const status = readTrimmedString(value, "status");

    if (!isBusinessCardTemplateStatus(status)) {
      return undefined;
    }

    patch.status = status;
  }

  if ("layout" in value) {
    const layout = normalizeBusinessCardTemplateLayout(value.layout);

    if (!layout) {
      return undefined;
    }

    patch.layout = layout;
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function isAdminBusinessCardTemplate(template: PrintTemplate) {
  return template.productId === businessCardProductId && template.source === "admin";
}

export function isPublishedBusinessCardTemplate(template: PrintTemplate) {
  return isAdminBusinessCardTemplate(template) && template.status === "published";
}

export function normalizeAdminBusinessCardTemplate(value: unknown): PrintTemplate | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const input = parseBusinessCardTemplateInput(value);
  const id = readTrimmedString(value, "id");
  const createdAt = readTrimmedString(value, "createdAt");
  const updatedAt = readOptionalTrimmedString(value, "updatedAt");

  if (!input || id.length === 0 || id.length > 120 || readTrimmedString(value, "productId") !== businessCardProductId || readTrimmedString(value, "source") !== "admin" || createdAt.length === 0) {
    return undefined;
  }

  return {
    id,
    productId: businessCardProductId,
    title: input.title,
    summary: input.summary,
    tags: input.tags,
    orientation: input.orientation,
    previewVariant: input.previewVariant,
    status: input.status,
    source: "admin",
    layout: input.layout,
    createdAt,
    updatedAt,
  };
}

export function getBusinessCardTemplates(templates: PrintTemplate[]) {
  return templates.filter((template) => template.productId === businessCardProductId);
}

export function getBusinessCardTemplateOrientation(template: PrintTemplate) {
  return template.orientation ?? "horizontal";
}

export function findBusinessCardTemplate(templates: PrintTemplate[], templateId?: string) {
  if (!templateId) {
    return undefined;
  }

  return getBusinessCardTemplates(templates).find((template) => template.id === templateId);
}

export function resolveBusinessCardTemplate(templates: PrintTemplate[], templateId?: string) {
  const businessCardTemplates = getBusinessCardTemplates(templates);

  return businessCardTemplates.find((template) => template.id === templateId) ?? businessCardTemplates[0];
}
