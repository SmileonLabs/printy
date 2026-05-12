import type { BusinessCardTemplateBackground, BusinessCardTemplateBox, BusinessCardTemplateFontFamily, BusinessCardTemplateIconElement, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId } from "@/lib/types";

export const defaultTrimWidthMm = 90;
export const defaultTrimHeightMm = 50;
export const cssPxPerMm = 96 / 25.4;
export const adminCanvasReferenceWidthPx = 720;
export const businessCardLogoShapeBorderColor = "#e4eaf3";
export const businessCardInfoBlockIconTextGapPx = 13;
export const businessCardContactItemGapPx = 2.5;
export const businessCardInfoBlockIconVisualWidthRatio = 0.55;
export const businessCardInfoBlockIconSvgPreserveAspectRatio = "xMaxYMid meet";

export const sampleBusinessCardFieldValues: Record<BusinessCardTemplateTextFieldId, string> = {
  role: "대표",
  name: "홍길동",
  phone: "010-1234-5678",
  mainPhone: "02-123-1234",
  fax: "02-123-1234",
  email: "prity@prity.com",
  website: "www.prity.com",
  address: "서울특별시 강남구 서초동 12-3 456동",
};

const contactFieldIds = new Set<BusinessCardTemplateTextFieldId>(["phone", "mainPhone", "fax", "email", "website", "address"]);

export type BusinessCardInfoBlockId = "contact" | "email" | "website" | "address";

type BusinessCardInfoBlockConfig = {
  id: BusinessCardInfoBlockId;
  fieldIds: BusinessCardTemplateTextFieldId[];
  icon?: BusinessCardIconBlockName;
};

type BusinessCardIconBlockName = "phone" | "email" | "web" | "building";

const businessCardInfoBlocks: BusinessCardInfoBlockConfig[] = [
  { id: "contact", fieldIds: ["phone", "mainPhone", "fax"], icon: "phone" },
  { id: "email", fieldIds: ["email"], icon: "email" },
  { id: "website", fieldIds: ["website"], icon: "web" },
  { id: "address", fieldIds: ["address"], icon: "building" },
];

export type BusinessCardContactRowItem = {
  field: BusinessCardTemplateTextElement;
  value: string;
};

export type BusinessCardContactRow = {
  id: string;
  items: BusinessCardContactRowItem[];
};

export type BusinessCardInfoBlock = {
  id: BusinessCardInfoBlockId;
  box: BusinessCardTemplateBox;
  icon?: BusinessCardTemplateIconElement;
  rows: BusinessCardContactRow[];
};

export type BusinessCardContactLayout = {
  blocks: BusinessCardInfoBlock[];
  fields: BusinessCardTemplateTextElement[];
  icons: BusinessCardTemplateIconElement[];
};

export type BusinessCardInfoBlockRenderMetrics = {
  boxWidth: number;
  boxHeight: number;
  paddingLeftPercent: number;
  iconTextPaddingPercent: number;
  iconLeftPercent: number;
  iconWidthPercent: number;
  iconHeightPercent: number;
};

export type BusinessCardInfoBlockRowRenderMetrics = {
  topPercent: number;
  heightPercent: number;
};

export function isBusinessCardContactFieldId(fieldId: BusinessCardTemplateTextFieldId) {
  return contactFieldIds.has(fieldId);
}

function unionBoxes(boxes: BusinessCardTemplateBox[]) {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function rowBox(row: BusinessCardContactRow) {
  return unionBoxes(row.items.map((item) => item.field.box));
}

function alignSingleContactItemToFirstSlot(blockId: BusinessCardInfoBlockId, items: BusinessCardContactRowItem[], fieldById: Map<BusinessCardTemplateTextFieldId, BusinessCardTemplateTextElement>) {
  if (blockId !== "contact" || items.length !== 1) {
    return items;
  }

  const firstContactField = fieldById.get("phone");

  if (!firstContactField?.visible) {
    return items;
  }

  return [{ ...items[0], field: { ...items[0].field, box: firstContactField.box } }];
}

export function resolveBusinessCardContactLayout(fields: BusinessCardTemplateTextElement[], icons: BusinessCardTemplateIconElement[], valueForField: (field: BusinessCardTemplateTextElement) => string): BusinessCardContactLayout {
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const iconByName = new Map(icons.filter((icon) => icon.visible).map((icon) => [icon.icon, icon]));
  const blocks: BusinessCardInfoBlock[] = [];
  const usedFieldIds = new Set<BusinessCardTemplateTextFieldId>();
  const usedIconIds = new Set<string>();

  for (const blockConfig of businessCardInfoBlocks) {
    const rawItems = blockConfig.fieldIds.flatMap((fieldId) => {
      const field = fieldById.get(fieldId);

      if (!field?.visible) {
        return [];
      }

      const value = displayBusinessCardFieldValue(field.id, valueForField(field));

      return value.length > 0 ? [{ field, value }] : [];
    });
    const items = alignSingleContactItemToFirstSlot(blockConfig.id, rawItems, fieldById);

    if (items.length === 0) {
      continue;
    }

    for (const item of items) {
      usedFieldIds.add(item.field.id);
    }

    const icon = blockConfig.icon ? iconByName.get(blockConfig.icon) : undefined;

    if (icon) {
      usedIconIds.add(icon.id);
    }

    const rows = [{ id: blockConfig.id, items }];
    const rawBlockBox = unionBoxes([...items.map((item) => item.field.box), ...(icon ? [icon.box] : [])]);

    blocks.push({ id: blockConfig.id, box: rawBlockBox, icon, rows });
  }

  return {
    blocks,
    fields: fields.filter((field) => !usedFieldIds.has(field.id)),
    icons: icons.filter((icon) => !usedIconIds.has(icon.id)),
  };
}

export function getBusinessCardInfoBlockRenderMetrics(block: BusinessCardInfoBlock): BusinessCardInfoBlockRenderMetrics {
  const fields = block.rows.flatMap((row) => row.items.map((item) => item.field));
  const boxWidth = block.box.width > 0 ? block.box.width : 1;
  const boxHeight = block.box.height > 0 ? block.box.height : 1;
  const textInset = fields.length > 0 ? Math.min(...fields.map((field) => field.box.x)) - block.box.x : 0;
  const paddingLeftPercent = Math.max((textInset / boxWidth) * 100, 0);

  if (!block.icon) {
    return { boxWidth, boxHeight, paddingLeftPercent, iconTextPaddingPercent: paddingLeftPercent, iconLeftPercent: 0, iconWidthPercent: 0, iconHeightPercent: 0 };
  }

  const iconRightInset = block.icon.box.x + block.icon.box.width - block.box.x;
  const iconTextPaddingPercent = Math.max(((iconRightInset - block.icon.box.width * (1 - businessCardInfoBlockIconVisualWidthRatio)) / boxWidth) * 100, 0);

  return {
    boxWidth,
    boxHeight,
    paddingLeftPercent,
    iconTextPaddingPercent,
    iconLeftPercent: ((block.icon.box.x - block.box.x) / boxWidth) * 100,
    iconWidthPercent: (block.icon.box.width / boxWidth) * 100,
    iconHeightPercent: (block.icon.box.height / boxHeight) * 100,
  };
}

export function getBusinessCardInfoBlockRowRenderMetrics(block: BusinessCardInfoBlock, row: BusinessCardContactRow): BusinessCardInfoBlockRowRenderMetrics {
  const currentRowBox = rowBox(row);
  const boxHeight = block.box.height > 0 ? block.box.height : 1;

  return {
    topPercent: ((currentRowBox.y - block.box.y) / boxHeight) * 100,
    heightPercent: (currentRowBox.height / boxHeight) * 100,
  };
}

export const fontFamilies: Record<BusinessCardTemplateFontFamily, string> = {
  sans: '"Noto Sans KR", "Nanum Gothic", "Apple SD Gothic Neo", sans-serif',
  serif: '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif',
  rounded: '"Gowun Dodum", "Noto Sans KR", "Nanum Gothic", sans-serif',
  mono: '"IBM Plex Mono", "Nanum Gothic Coding", "Noto Sans KR", monospace',
  display: '"Gowun Dodum", "Noto Sans KR", "Nanum Gothic", sans-serif',
  handwriting: '"Gowun Dodum", "Noto Sans KR", "Nanum Pen Script", cursive',
};

export function readPositiveMm(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(3)) : fallback;
}

export function formatPercent(value: number, fallback: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : fallback;
}

export function readSafeColor(value: string | undefined, fallback: string) {
  const color = value?.trim();

  if (!color) {
    return fallback;
  }

  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}

export function normalizeBusinessCardText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function businessCardFaxText(value: string) {
  const number = value.trim().replace(/^fax\s*[:：-]?\s*/i, "");

  return number ? `FAX ${number}` : "";
}

export function displayBusinessCardFieldValue(fieldId: BusinessCardTemplateTextFieldId, value: string) {
  return normalizeBusinessCardText(fieldId === "fax" ? businessCardFaxText(value) : value);
}

export function editableBusinessCardFieldValue(fieldId: BusinessCardTemplateTextFieldId, value: string) {
  return fieldId === "fax" ? value.replace(/^fax\s*[:：-]?\s*/i, "") : value;
}

export function boxStyle(box: BusinessCardTemplateBox) {
  return {
    left: `${formatPercent(box.x, 0)}%`,
    top: `${formatPercent(box.y, 0)}%`,
    width: `${formatPercent(box.width, 1)}%`,
    height: `${formatPercent(box.height, 1)}%`,
  };
}

export function boxStyleText(box: BusinessCardTemplateBox) {
  return `left:${formatPercent(box.x, 0)}%;top:${formatPercent(box.y, 0)}%;width:${formatPercent(box.width, 1)}%;height:${formatPercent(box.height, 1)}%;`;
}

export function getBusinessCardCssPixelScale(trimWidthMm: number) {
  return (trimWidthMm * cssPxPerMm) / adminCanvasReferenceWidthPx;
}

export function getBusinessCardTrimMetrics(trim: { widthMm: number; heightMm: number }) {
  const trimWidthMm = readPositiveMm(trim.widthMm, defaultTrimWidthMm);
  const trimHeightMm = readPositiveMm(trim.heightMm, defaultTrimHeightMm);
  const referenceSideMm = Math.max(trimWidthMm, trimHeightMm);

  return {
    trimWidthMm,
    trimHeightMm,
    trimWidthCssPx: trimWidthMm * cssPxPerMm,
    trimHeightCssPx: trimHeightMm * cssPxPerMm,
    cssPixelScale: getBusinessCardCssPixelScale(referenceSideMm),
  };
}

export function businessCardIconChromeStyle(cssPixelScale: number) {
  return {
    borderWidthPx: formatPercent(cssPixelScale, 0.5),
    paddingPx: formatPercent(4 * cssPixelScale, 2),
  };
}

export function businessCardInfoBlockIconTextGapStylePx(block: BusinessCardInfoBlock, scale = 1) {
  const textGapPx = block.icon?.textGapPx;
  const gapPx = Number.isFinite(textGapPx) ? textGapPx : businessCardInfoBlockIconTextGapPx;

  return formatPercent((gapPx ?? businessCardInfoBlockIconTextGapPx) * scale, businessCardInfoBlockIconTextGapPx);
}

export function estimatedBusinessCardTextWidthEm(value: string) {
  return Array.from(value).reduce((total, char) => {
    if (/\s/.test(char)) {
      return total + 0.3;
    }

    return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(char) ? total + 1 : total + 0.56;
  }, 0);
}

export function businessCardTrimWidthScale(trim: { widthMm: number; heightMm: number }) {
  const trimWidthMm = readPositiveMm(trim.widthMm, defaultTrimWidthMm);
  const trimHeightMm = readPositiveMm(trim.heightMm, defaultTrimHeightMm);

  return trimWidthMm / Math.max(trimWidthMm, trimHeightMm);
}

export function fittedBusinessCardFontSizePx(field: BusinessCardTemplateTextElement, value: string, cssPixelScale: number, availableWidthPercent = field.box.width, paddingPx = 0, trimWidthScale = 1) {
  const baseFontSizePx = field.fontSize * cssPixelScale;
  const availableWidthPx = Math.max(1, (adminCanvasReferenceWidthPx * cssPixelScale * trimWidthScale * (availableWidthPercent / 100) - paddingPx) * 0.99);
  const estimatedWidthEm = estimatedBusinessCardTextWidthEm(value);

  if (estimatedWidthEm <= 0) {
    return formatPercent(baseFontSizePx, 8);
  }

  const fittedFontSizePx = availableWidthPx / estimatedWidthEm;

  return formatPercent(Math.min(baseFontSizePx, fittedFontSizePx), baseFontSizePx);
}

export function backgroundColor(background: BusinessCardTemplateBackground) {
  if (!background.enabled) {
    return "#ffffff";
  }

  return background.type === "color" ? readSafeColor(background.color, "#ffffff") : readSafeColor(background.color, "#ffffff");
}
