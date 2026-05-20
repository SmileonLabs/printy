import type { BusinessCardProductionOptions, Member, ResolvedLogoOption } from "@/lib/types";

export type AiBusinessCardSideId = "front" | "back";
export type AiBusinessCardTextField = "brandName" | "category" | "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "titleLine1" | "titleLine2" | "adLine1" | "adLine2" | "instagram" | "qrCode";
export type AiBusinessCardFontFamily = "Pretendard" | "Noto Sans KR" | "Noto Serif KR" | "Gowun Dodum";
export type AiBusinessCardFontWeight = "regular" | "medium" | "bold";
export type AiBusinessCardTextAlign = "left" | "center" | "right";
export type AiBusinessCardShapeKind = "rect" | "roundRect" | "circle";
export type AiBusinessCardIconKind = "name" | "role" | "mobile" | "phone" | "email" | "location" | "address" | "company" | "web" | "fax" | "account" | "instagram";

export type AiBusinessCardCanvas = {
  widthMm: 92;
  heightMm: 52;
  bleedMm: 0;
  safeMarginMm: number;
};

export type AiBusinessCardBackground = {
  color: string;
  image?: {
    src: string;
    fit: "cover" | "contain";
    opacity?: number;
  };
};

export type AiBusinessCardTextElement = {
  type: "text";
  field: AiBusinessCardTextField;
  candidateId?: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontFamily: AiBusinessCardFontFamily;
  fontWeight: AiBusinessCardFontWeight;
  fontSizePt: number;
  color: string;
  align: AiBusinessCardTextAlign;
  layer: number;
};

export type AiBusinessCardLogoElement = {
  type: "logo";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  layer: number;
};

export type AiBusinessCardLineElement = {
  type: "line";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  color: string;
  layer: number;
};

export type AiBusinessCardShapeElement = {
  type: "shape";
  kind: AiBusinessCardShapeKind;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fill: string;
  stroke?: string;
  strokeWidthMm?: number;
  radiusMm?: number;
  opacity?: number;
  layer: number;
};

export type AiBusinessCardIconElement = {
  type: "icon";
  icon: AiBusinessCardIconKind;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  color: string;
  layer: number;
};

export type AiBusinessCardQrElement = {
  type: "qr";
  valueField: "website" | "email" | "phone";
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  color: string;
  backgroundColor: string;
  layer: number;
};

export type AiBusinessCardImageElement = {
  type: "image";
  src: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fit: "cover" | "contain";
  opacity?: number;
  layer: number;
};

export type AiBusinessCardElement = AiBusinessCardTextElement | AiBusinessCardLogoElement | AiBusinessCardLineElement | AiBusinessCardShapeElement | AiBusinessCardIconElement | AiBusinessCardQrElement | AiBusinessCardImageElement;

export type AiBusinessCardSide = {
  background: AiBusinessCardBackground;
  elements: AiBusinessCardElement[];
};

export type AiBusinessCardDesign = {
  version: 1;
  canvas: AiBusinessCardCanvas;
  sides: Record<AiBusinessCardSideId, AiBusinessCardSide>;
};

export type AiBusinessCardInput = {
  brandName: string;
  category: string;
  mood?: string;
  colors?: string;
  referenceStyle?: string;
  frontNote?: string;
  backNote?: string;
  mockupRequest?: string;
  member: Member;
  logo?: ResolvedLogoOption;
  templateId?: string;
  productionOptions?: BusinessCardProductionOptions;
};

const textFields = new Set<AiBusinessCardTextField>(["brandName", "category", "name", "role", "phone", "mainPhone", "fax", "email", "website", "address", "account", "titleLine1", "titleLine2", "adLine1", "adLine2", "instagram", "qrCode"]);
const fontFamilies = new Set<AiBusinessCardFontFamily>(["Pretendard", "Noto Sans KR", "Noto Serif KR", "Gowun Dodum"]);
const fontWeights = new Set<AiBusinessCardFontWeight>(["regular", "medium", "bold"]);
const textAligns = new Set<AiBusinessCardTextAlign>(["left", "center", "right"]);
const shapeKinds = new Set<AiBusinessCardShapeKind>(["rect", "roundRect", "circle"]);
const iconKinds = new Set<AiBusinessCardIconKind>(["name", "role", "mobile", "phone", "email", "location", "address", "company", "web", "fax", "account", "instagram"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

function readNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function readOptionalNumber(value: Record<string, unknown>, key: string, min: number, max: number) {
  const number = readNumber(value, key);

  return number === undefined || number < min || number > max ? undefined : number;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function readColor(value: Record<string, unknown>, key: string, fallback: string) {
  const color = readString(value, key);

  return isHexColor(color) ? color.toLowerCase() : fallback;
}

function readBox(value: Record<string, unknown>) {
  const xMm = readNumber(value, "xMm");
  const yMm = readNumber(value, "yMm");
  const widthMm = readNumber(value, "widthMm");
  const heightMm = readNumber(value, "heightMm");

  if (xMm === undefined || yMm === undefined || widthMm === undefined || heightMm === undefined || xMm < -3 || yMm < -3 || widthMm <= 0 || heightMm <= 0 || xMm + widthMm > 95 || yMm + heightMm > 55) {
    return undefined;
  }

  return { xMm, yMm, widthMm, heightMm };
}

function readLayer(value: Record<string, unknown>) {
  return Math.round(readOptionalNumber(value, "layer", 0, 999) ?? 10);
}

function readTextElement(value: Record<string, unknown>): AiBusinessCardTextElement | undefined {
  const box = readBox(value);
  const field = readString(value, "field") as AiBusinessCardTextField;
  const fontFamily = readString(value, "fontFamily") as AiBusinessCardFontFamily;
  const fontWeight = readString(value, "fontWeight") as AiBusinessCardFontWeight;
  const align = readString(value, "align") as AiBusinessCardTextAlign;
  const fontSizePt = readOptionalNumber(value, "fontSizePt", 1, 32);

  if (!box || !textFields.has(field) || !fontFamilies.has(fontFamily) || !fontWeights.has(fontWeight) || !textAligns.has(align) || fontSizePt === undefined) {
    return undefined;
  }

  const candidateId = readString(value, "candidateId");

  return { type: "text", field, candidateId: candidateId || undefined, ...box, fontFamily, fontWeight, fontSizePt, color: readColor(value, "color", "#111111"), align, layer: readLayer(value) };
}

function readElement(value: unknown): AiBusinessCardElement | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const type = readString(value, "type");
  const box = readBox(value);

  if (type === "text") {
    return readTextElement(value);
  }

  if (!box) {
    return undefined;
  }

  if (type === "logo") {
    return { type: "logo", ...box, layer: readLayer(value) };
  }

  if (type === "line") {
    return { type: "line", ...box, color: readColor(value, "color", "#111111"), layer: readLayer(value) };
  }

  if (type === "shape") {
    const kind = readString(value, "kind") as AiBusinessCardShapeKind;

    return shapeKinds.has(kind) ? { type: "shape", kind, ...box, fill: readColor(value, "fill", "#f3f6fb"), stroke: isHexColor(readString(value, "stroke")) ? readString(value, "stroke").toLowerCase() : undefined, strokeWidthMm: readOptionalNumber(value, "strokeWidthMm", 0, 5), radiusMm: readOptionalNumber(value, "radiusMm", 0, 20), opacity: readOptionalNumber(value, "opacity", 0, 1), layer: readLayer(value) } : undefined;
  }

  if (type === "icon") {
    const icon = readString(value, "icon") as AiBusinessCardIconKind;

    return iconKinds.has(icon) ? { type: "icon", icon, ...box, color: readColor(value, "color", "#111111"), layer: readLayer(value) } : undefined;
  }

  if (type === "qr") {
    const valueField = readString(value, "valueField");

    return valueField === "website" || valueField === "email" || valueField === "phone" ? { type: "qr", valueField, ...box, color: readColor(value, "color", "#111111"), backgroundColor: readColor(value, "backgroundColor", "#ffffff"), layer: readLayer(value) } : undefined;
  }

  if (type === "image") {
    const src = readString(value, "src");
    const fit = readString(value, "fit");

    return (src.startsWith("/uploads/") || src.startsWith("data:image/")) && (fit === "cover" || fit === "contain") ? { type: "image", src, ...box, fit, opacity: readOptionalNumber(value, "opacity", 0, 1), layer: readLayer(value) } : undefined;
  }

  return undefined;
}

function readSide(value: unknown): AiBusinessCardSide | undefined {
  if (!isRecord(value) || !isRecord(value.background) || !Array.isArray(value.elements)) {
    return undefined;
  }

  const image = isRecord(value.background.image) ? value.background.image : undefined;
  const imageSrc = image ? readString(image, "src") : "";
  const imageFit = image ? readString(image, "fit") : "";
  const background: AiBusinessCardBackground = { color: readColor(value.background, "color", "#ffffff") };

  if (image && (imageSrc.startsWith("/uploads/") || imageSrc.startsWith("data:image/")) && (imageFit === "cover" || imageFit === "contain")) {
    background.image = { src: imageSrc, fit: imageFit, opacity: readOptionalNumber(image, "opacity", 0, 1) };
  }

  const elements = value.elements.map(readElement).filter((element): element is AiBusinessCardElement => element !== undefined).slice(0, 80);

  return { background, elements };
}

export function validateAiBusinessCardDesign(value: unknown): AiBusinessCardDesign | undefined {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.canvas) || !isRecord(value.sides)) {
    return undefined;
  }

  const safeMarginMm = readOptionalNumber(value.canvas, "safeMarginMm", 2, 10) ?? 4;
  const front = readSide(value.sides.front);
  const back = readSide(value.sides.back);

  if (value.canvas.widthMm !== 92 || value.canvas.heightMm !== 52 || value.canvas.bleedMm !== 0 || !front || !back) {
    return undefined;
  }

  return { version: 1, canvas: { widthMm: 92, heightMm: 52, bleedMm: 0, safeMarginMm }, sides: { front, back } };
}

export function createDefaultAiBusinessCardDesign(input: AiBusinessCardInput): AiBusinessCardDesign {
  const dark = input.colors?.includes("검") || input.mood?.includes("고급");
  const frontColor = dark ? "#111111" : "#f7f9fc";
  const frontText = dark ? "#ffffff" : "#111111";

  return {
    version: 1,
    canvas: { widthMm: 92, heightMm: 52, bleedMm: 0, safeMarginMm: 4 },
    sides: {
      front: {
        background: { color: frontColor },
        elements: [
          { type: "shape", kind: "circle", xMm: 58, yMm: -16, widthMm: 42, heightMm: 42, fill: dark ? "#2f66ff" : "#dbeafe", opacity: 0.9, layer: 1 },
          { type: "logo", xMm: 8, yMm: 10, widthMm: 18, heightMm: 18, layer: 10 },
          { type: "text", field: "brandName", xMm: 8, yMm: 31, widthMm: 50, heightMm: 7, fontFamily: "Noto Sans KR", fontWeight: "bold", fontSizePt: 12, color: frontText, align: "left", layer: 20 },
          { type: "text", field: "category", xMm: 8, yMm: 39, widthMm: 50, heightMm: 5, fontFamily: "Noto Sans KR", fontWeight: "regular", fontSizePt: 7, color: dark ? "#dbeafe" : "#365075", align: "left", layer: 21 },
        ],
      },
      back: {
        background: { color: "#ffffff" },
        elements: [
          { type: "line", xMm: 8, yMm: 11, widthMm: 74, heightMm: 0.25, color: "#111111", layer: 1 },
          { type: "text", field: "name", xMm: 8, yMm: 15, widthMm: 34, heightMm: 7, fontFamily: "Noto Sans KR", fontWeight: "bold", fontSizePt: 12, color: "#111111", align: "left", layer: 20 },
          { type: "text", field: "role", xMm: 8, yMm: 23, widthMm: 34, heightMm: 5, fontFamily: "Noto Sans KR", fontWeight: "regular", fontSizePt: 7, color: "#4b5563", align: "left", layer: 21 },
          { type: "text", field: "phone", xMm: 48, yMm: 15, widthMm: 34, heightMm: 4, fontFamily: "Noto Sans KR", fontWeight: "medium", fontSizePt: 7, color: "#111111", align: "left", layer: 20 },
          { type: "text", field: "email", xMm: 48, yMm: 21, widthMm: 34, heightMm: 4, fontFamily: "Noto Sans KR", fontWeight: "medium", fontSizePt: 7, color: "#111111", align: "left", layer: 20 },
          { type: "text", field: "website", xMm: 48, yMm: 27, widthMm: 34, heightMm: 4, fontFamily: "Noto Sans KR", fontWeight: "medium", fontSizePt: 7, color: "#111111", align: "left", layer: 20 },
          { type: "text", field: "address", xMm: 8, yMm: 39, widthMm: 74, heightMm: 5, fontFamily: "Noto Sans KR", fontWeight: "regular", fontSizePt: 6, color: "#4b5563", align: "left", layer: 20 },
        ],
      },
    },
  };
}
