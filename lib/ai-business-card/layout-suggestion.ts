import { normalizeBusinessCardTemplateLayout } from "@/lib/business-card-templates";
import type { BusinessCardTemplateBox, BusinessCardTemplateLayout, BusinessCardTemplateSideId, BusinessCardTemplateTextElement } from "@/lib/types";

export type BusinessCardLayoutIntent = {
  layoutStyle: "minimal_luxury" | "bold_promo" | "clean_modern" | "friendly";
  spacing: "compact" | "comfortable" | "wide";
  logoPriority: "low" | "medium" | "high";
  textAlignment: "left" | "center" | "right";
};

type LayoutRequestContext = {
  brandName: string;
  category: string;
  prompt: string;
  baseLayout: BusinessCardTemplateLayout;
};

const sideIds: BusinessCardTemplateSideId[] = ["front", "back"];

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

export function fallbackBusinessCardLayoutIntent(prompt: string): BusinessCardLayoutIntent {
  const normalized = prompt.toLowerCase();
  const isLuxury = includesAny(normalized, ["럭셔리", "고급", "프리미엄", "luxury", "premium"]);
  const isBold = includesAny(normalized, ["강조", "크게", "눈에", "할인", "행사", "bold", "promo"]);
  const isFriendly = includesAny(normalized, ["귀여", "친근", "부드", "따뜻", "friendly"]);
  const spacing = includesAny(normalized, ["여백", "넉넉", "시원", "wide", "comfortable"]) ? "wide" : includesAny(normalized, ["빽빽", "많이", "compact"]) ? "compact" : "comfortable";
  const logoPriority = includesAny(normalized, ["로고 강조", "로고 크게", "logo", "브랜드 강조"]) ? "high" : isBold ? "medium" : "high";
  const textAlignment = includesAny(normalized, ["왼쪽", "좌측", "left"]) ? "left" : includesAny(normalized, ["오른쪽", "우측", "right"]) ? "right" : isLuxury ? "left" : "center";

  return { layoutStyle: isLuxury ? "minimal_luxury" : isBold ? "bold_promo" : isFriendly ? "friendly" : "clean_modern", spacing, logoPriority, textAlignment };
}

function backgroundForIntent(intent: BusinessCardLayoutIntent) {
  if (intent.layoutStyle === "minimal_luxury") return "#f8f3e7";
  if (intent.layoutStyle === "bold_promo") return "#fff7ed";
  if (intent.layoutStyle === "friendly") return "#eff6ff";
  return "#ffffff";
}

function colorForIntent(intent: BusinessCardLayoutIntent, primary: boolean) {
  if (intent.layoutStyle === "minimal_luxury" && primary) return "gradient:gold";
  if (intent.layoutStyle === "friendly" && primary) return "#2563eb";
  return "#111827";
}

function frontLogoBox(intent: BusinessCardLayoutIntent): BusinessCardTemplateBox {
  if (intent.textAlignment === "left") {
    return intent.logoPriority === "high" ? { x: 64, y: 20, width: 24, height: 24 } : { x: 69, y: 23, width: 18, height: 18 };
  }

  return intent.logoPriority === "high" ? { x: 36, y: 10, width: 28, height: 24 } : { x: 40, y: 12, width: 20, height: 18 };
}

function frontTextBox(field: BusinessCardTemplateTextElement, intent: BusinessCardLayoutIntent): BusinessCardTemplateBox {
  if (field.id === "name") {
    return intent.textAlignment === "left" ? { x: 10, y: 30, width: 48, height: 12 } : { x: 18, y: 42, width: 64, height: 12 };
  }

  if (field.id === "role") {
    return intent.textAlignment === "left" ? { x: 10, y: 20, width: 42, height: 8 } : { x: 24, y: 34, width: 52, height: 7 };
  }

  const compactGap = intent.spacing === "compact" ? 8 : 10;
  const contactX = intent.textAlignment === "left" ? 10 : 23;
  const contactWidth = intent.textAlignment === "left" ? 50 : 54;
  const rowById: Partial<Record<BusinessCardTemplateTextElement["id"], number>> = {
    mainPhone: 58,
    phone: 58 + compactGap,
    email: 58 + compactGap * 2,
    website: 58 + compactGap * 3,
    address: 58 + compactGap * 4,
    fax: 58 + compactGap * 4,
    account: 58 + compactGap * 4,
    instagram: 58 + compactGap * 4,
  };

  if (field.id === "qrCode") {
    return { x: 78, y: 70, width: 13, height: 22 };
  }

  return { x: contactX, y: rowById[field.id] ?? field.box.y, width: contactWidth, height: 7 };
}

function updateFrontField(field: BusinessCardTemplateTextElement, intent: BusinessCardLayoutIntent): BusinessCardTemplateTextElement {
  const isPrimary = field.id === "name" || field.id === "role";
  const isContact = field.id === "phone" || field.id === "mainPhone" || field.id === "email" || field.id === "website" || field.id === "address" || field.id === "fax" || field.id === "account" || field.id === "instagram" || field.id === "qrCode";

  return {
    ...field,
    visible: isPrimary || isContact ? field.visible : field.visible,
    box: isPrimary || isContact ? frontTextBox(field, intent) : field.box,
    fontFamily: intent.layoutStyle === "minimal_luxury" && field.id !== "qrCode" ? "serif" : field.fontFamily,
    fontSize: field.id === "name" ? 22 : field.id === "role" ? 12 : field.fontSize,
    color: colorForIntent(intent, isPrimary),
    fontWeight: field.id === "name" ? "bold" : field.fontWeight,
    italic: false,
    align: intent.textAlignment,
  };
}

function updateBackField(field: BusinessCardTemplateTextElement, intent: BusinessCardLayoutIntent): BusinessCardTemplateTextElement {
  if (field.id === "address") {
    return { ...field, visible: field.visible, box: { x: 16, y: 60, width: 68, height: 8 }, align: "center", color: "#111827", fontFamily: intent.layoutStyle === "minimal_luxury" ? "serif" : "sans" };
  }

  return { ...field, color: "#111827", fontFamily: intent.layoutStyle === "minimal_luxury" ? "serif" : field.fontFamily, italic: false };
}

export function applyBusinessCardLayoutIntent(context: LayoutRequestContext, intent: BusinessCardLayoutIntent): BusinessCardTemplateLayout {
  const baseLayout = normalizeBusinessCardTemplateLayout(context.baseLayout) ?? context.baseLayout;
  const background = { enabled: true as const, type: "color" as const, color: backgroundForIntent(intent) };
  const nextLayout: BusinessCardTemplateLayout = {
    ...baseLayout,
    sides: {
      front: {
        ...baseLayout.sides.front,
        background,
        logo: { ...baseLayout.sides.front.logo, visible: true, box: frontLogoBox(intent), assetType: baseLayout.sides.front.logo.assetType },
        fields: baseLayout.sides.front.fields.map((field) => updateFrontField(field, intent)),
        icons: baseLayout.sides.front.icons.map((icon) => ({ ...icon, color: colorForIntent(intent, false) })),
      },
      back: {
        ...baseLayout.sides.back,
        background,
        logo: { ...baseLayout.sides.back.logo, visible: intent.logoPriority !== "low", box: intent.logoPriority === "high" ? { x: 38, y: 24, width: 24, height: 22 } : baseLayout.sides.back.logo.box, assetType: baseLayout.sides.back.logo.assetType },
        fields: baseLayout.sides.back.fields.map((field) => updateBackField(field, intent)),
        icons: baseLayout.sides.back.icons.map((icon) => ({ ...icon, color: colorForIntent(intent, false) })),
      },
    },
  };

  return normalizeBusinessCardTemplateLayout(nextLayout) ?? nextLayout;
}

export function isBusinessCardLayoutIntent(value: unknown): value is BusinessCardLayoutIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (record.layoutStyle === "minimal_luxury" || record.layoutStyle === "bold_promo" || record.layoutStyle === "clean_modern" || record.layoutStyle === "friendly") && (record.spacing === "compact" || record.spacing === "comfortable" || record.spacing === "wide") && (record.logoPriority === "low" || record.logoPriority === "medium" || record.logoPriority === "high") && (record.textAlignment === "left" || record.textAlignment === "center" || record.textAlignment === "right");
}

export function normalizeBusinessCardLayoutIntent(value: unknown, prompt: string): BusinessCardLayoutIntent {
  if (isBusinessCardLayoutIntent(value)) {
    return value;
  }

  const fallback = fallbackBusinessCardLayoutIntent(prompt);

  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    layoutStyle: record.layoutStyle === "minimal_luxury" || record.layoutStyle === "bold_promo" || record.layoutStyle === "clean_modern" || record.layoutStyle === "friendly" ? record.layoutStyle : fallback.layoutStyle,
    spacing: record.spacing === "compact" || record.spacing === "comfortable" || record.spacing === "wide" ? record.spacing : fallback.spacing,
    logoPriority: record.logoPriority === "low" || record.logoPriority === "medium" || record.logoPriority === "high" ? record.logoPriority : fallback.logoPriority,
    textAlignment: record.textAlignment === "left" || record.textAlignment === "center" || record.textAlignment === "right" ? record.textAlignment : fallback.textAlignment,
  };
}

export function visibleBusinessCardSideIds() {
  return sideIds;
}
