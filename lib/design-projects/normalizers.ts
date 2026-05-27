import type { DesignBackground, DesignBox, DesignElement, DesignLayout, DesignMockup, DesignPage, DesignPdfRecord, DesignProductType, DesignProject, DesignProjectSource, DesignProjectStatus } from "@/lib/design-projects/types";
import { businessCardTemplateFontFamilies, businessCardTemplateIconIds } from "@/lib/business-card-templates";
import type { BusinessCardTemplateFontFamily, BusinessCardTemplateIconId } from "@/lib/types";

const productTypes = new Set<DesignProductType>(["business-card", "banner", "signage", "flyer", "poster", "brochure", "sticker"]);
const projectStatuses = new Set<DesignProjectStatus>(["draft", "completed"]);
const projectSources = new Set<DesignProjectSource>(["business-card-draft", "ai-business-card-mockup", "print-product-draft", "design-project"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const text = readString(value);

  return text.length > 0 ? text : undefined;
}

function readFontFamily(value: unknown): BusinessCardTemplateFontFamily | undefined {
  return typeof value === "string" && businessCardTemplateFontFamilies.includes(value as BusinessCardTemplateFontFamily) ? value as BusinessCardTemplateFontFamily : undefined;
}

function readIconId(value: unknown): BusinessCardTemplateIconId | undefined {
  return typeof value === "string" && businessCardTemplateIconIds.includes(value as BusinessCardTemplateIconId) ? value as BusinessCardTemplateIconId : undefined;
}

function readBox(value: unknown): DesignBox | undefined {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
    return undefined;
  }

  if (value.x < 0 || value.y < 0 || value.width <= 0 || value.height <= 0 || value.x + value.width > 100 || value.y + value.height > 100) {
    return undefined;
  }

  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function readBackground(value: unknown): DesignBackground | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.type === "none") {
    return { type: "none" };
  }

  const color = readOptionalString(value.color);

  if (value.type === "color" && color) {
    return { type: "color", color };
  }

  const imageUrl = readOptionalString(value.imageUrl);

  if (value.type === "image" && imageUrl) {
    return color ? { type: "image", imageUrl, color } : { type: "image", imageUrl };
  }

  return undefined;
}

function readElement(value: unknown): DesignElement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readOptionalString(value.id);
  const box = readBox(value.box);

  if (!id || !box || typeof value.visible !== "boolean") {
    return undefined;
  }

  if (value.type === "logo") {
    const assetType = value.assetType === "png" || value.assetType === "svg" ? value.assetType : undefined;

    return { type: "logo", id, visible: value.visible, box, assetType };
  }

  if (value.type === "qr") {
    return { type: "qr", id, label: readOptionalString(value.label), fieldId: readOptionalString(value.fieldId), value: readOptionalString(value.value), visible: value.visible, box };
  }

  if (value.type === "line" && (value.orientation === "horizontal" || value.orientation === "vertical")) {
    const color = readOptionalString(value.color);

    return color ? { type: "line", id, orientation: value.orientation, visible: value.visible, box, color } : undefined;
  }

  if (value.type === "icon") {
    const icon = readIconId(value.icon);
    const color = readOptionalString(value.color);
    const textGapPx = isFiniteNumber(value.textGapPx) ? value.textGapPx : undefined;

    return icon && color ? { type: "icon", id, icon, visible: value.visible, box, color, textGapPx } : undefined;
  }

  if (value.type === "shape") {
    const fillColor = readOptionalString(value.fillColor);
    const strokeColor = readOptionalString(value.strokeColor);

    return fillColor && strokeColor ? { type: "shape", id, label: readOptionalString(value.label), prompt: readOptionalString(value.prompt), visible: value.visible, box, fillColor, strokeColor, textColor: readOptionalString(value.textColor), glyph: readOptionalString(value.glyph) } : undefined;
  }

  if (value.type === "text") {
    const fontFamily = readFontFamily(value.fontFamily);

    if (!fontFamily || !isFiniteNumber(value.fontSize) || typeof value.color !== "string" || (value.fontWeight !== "regular" && value.fontWeight !== "bold") || typeof value.italic !== "boolean" || (value.align !== "left" && value.align !== "center" && value.align !== "right")) {
      return undefined;
    }

    return { type: "text", id, label: readOptionalString(value.label), fieldId: readOptionalString(value.fieldId), value: readOptionalString(value.value), visible: value.visible, box, fontFamily, fontSize: value.fontSize, color: value.color, fontWeight: value.fontWeight, italic: value.italic, align: value.align };
  }

  return undefined;
}

function readPage(value: unknown): DesignPage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readOptionalString(value.id);
  const label = readOptionalString(value.label);
  const background = readBackground(value.background);

  if (!id || !label || !background || !Array.isArray(value.elements)) {
    return undefined;
  }

  const elements = value.elements.map(readElement);

  if (elements.some((element) => element === undefined)) {
    return undefined;
  }

  return { id, label, background, elements: elements.filter((element): element is DesignElement => element !== undefined) };
}

export function normalizeDesignLayout(value: unknown): DesignLayout | undefined {
  if (!isRecord(value) || !isRecord(value.canvas) || !isFiniteNumber(value.canvas.widthMm) || !isFiniteNumber(value.canvas.heightMm) || !Array.isArray(value.pages)) {
    return undefined;
  }

  if (value.canvas.widthMm <= 0 || value.canvas.heightMm <= 0) {
    return undefined;
  }

  const pages = value.pages.map(readPage);

  if (pages.length === 0 || pages.some((page) => page === undefined)) {
    return undefined;
  }

  return {
    canvas: {
      widthMm: value.canvas.widthMm,
      heightMm: value.canvas.heightMm,
      bleedMm: isFiniteNumber(value.canvas.bleedMm) && value.canvas.bleedMm >= 0 ? value.canvas.bleedMm : undefined,
      safeMarginMm: isFiniteNumber(value.canvas.safeMarginMm) && value.canvas.safeMarginMm >= 0 ? value.canvas.safeMarginMm : undefined,
    },
    pages: pages.filter((page): page is DesignPage => page !== undefined),
  };
}

export function normalizeDesignMockup(value: unknown): DesignMockup | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readOptionalString(value.id);
  const imageUrl = readOptionalString(value.imageUrl);
  const title = readOptionalString(value.title);
  const layoutSnapshot = normalizeDesignLayout(value.layoutSnapshot);

  if (!id || !imageUrl || !title || !layoutSnapshot) {
    return undefined;
  }

  const source = typeof value.source === "string" && projectSources.has(value.source as DesignProjectSource) ? value.source as DesignProjectSource : undefined;

  return { id, imageUrl, cleanImageUrl: readOptionalString(value.cleanImageUrl), title, layoutSnapshot, createdAt: readOptionalString(value.createdAt) ?? new Date(0).toISOString(), source };
}

function normalizePdfRecord(value: unknown): DesignPdfRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const url = readOptionalString(value.url);
  const fileName = readOptionalString(value.fileName);

  return url && fileName ? { url, fileName, createdAt: readOptionalString(value.createdAt) } : undefined;
}

export function normalizeDesignProject(value: unknown): DesignProject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readOptionalString(value.id);
  const brandId = readOptionalString(value.brandId);
  const title = readOptionalString(value.title);
  const layout = normalizeDesignLayout(value.layout);
  const productType = typeof value.productType === "string" && productTypes.has(value.productType as DesignProductType) ? value.productType as DesignProductType : undefined;
  const status = typeof value.status === "string" && projectStatuses.has(value.status as DesignProjectStatus) ? value.status as DesignProjectStatus : undefined;
  const source = typeof value.source === "string" && projectSources.has(value.source as DesignProjectSource) ? value.source as DesignProjectSource : undefined;

  if (!id || !brandId || !title || !layout || !productType || !status || !source || !Array.isArray(value.mockups)) {
    return undefined;
  }

  const mockups = value.mockups.map(normalizeDesignMockup);

  if (mockups.some((mockup) => mockup === undefined)) {
    return undefined;
  }

  return {
    id,
    brandId,
    productType,
    title,
    status,
    layout,
    mockups: mockups.filter((mockup): mockup is DesignMockup => mockup !== undefined),
    selectedMockupId: readOptionalString(value.selectedMockupId),
    pdf: normalizePdfRecord(value.pdf),
    source,
    legacyId: readOptionalString(value.legacyId),
    createdAt: readOptionalString(value.createdAt) ?? new Date(0).toISOString(),
    updatedAt: readOptionalString(value.updatedAt) ?? readOptionalString(value.createdAt) ?? new Date(0).toISOString(),
  };
}
