import { normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import type { PrintProductProductionField, PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

export type PrintProductLayoutIntent = {
  layoutStyle: "minimal_luxury" | "bold_promo" | "clean_modern" | "friendly";
  spacing: "compact" | "comfortable" | "wide";
  logoPriority: "low" | "medium" | "high";
  textAlignment: "left" | "center" | "right";
};

type LayoutRequestContext = {
  brandName: string;
  category: string;
  prompt: string;
  productType: PrintProductProductionType;
  baseLayout: PrintProductProductionLayout;
};

function includesAny(value: string, words: string[]) {
  return words.some((word) => value.includes(word));
}

export function fallbackPrintProductLayoutIntent(prompt: string): PrintProductLayoutIntent {
  const normalized = prompt.toLowerCase();
  const isLuxury = includesAny(normalized, ["럭셔리", "고급", "프리미엄", "luxury", "premium"]);
  const isBold = includesAny(normalized, ["강조", "크게", "눈에", "할인", "행사", "bold", "promo"]);
  const isFriendly = includesAny(normalized, ["귀여", "친근", "부드", "따뜻", "friendly"]);
  const spacing = includesAny(normalized, ["여백", "넉넉", "시원", "wide", "comfortable"]) ? "comfortable" : includesAny(normalized, ["빽빽", "많이", "compact"]) ? "compact" : "wide";
  const logoPriority = includesAny(normalized, ["로고 강조", "로고 크게", "logo", "브랜드 강조"]) ? "high" : isBold ? "medium" : "high";
  const textAlignment = includesAny(normalized, ["왼쪽", "좌측", "left"]) ? "left" : includesAny(normalized, ["오른쪽", "우측", "right"]) ? "right" : isLuxury ? "left" : "center";

  return { layoutStyle: isLuxury ? "minimal_luxury" : isBold ? "bold_promo" : isFriendly ? "friendly" : "clean_modern", spacing, logoPriority, textAlignment };
}

function readTextColor(intent: PrintProductLayoutIntent) {
  if (intent.layoutStyle === "minimal_luxury") return "gradient:gold";
  if (intent.layoutStyle === "bold_promo") return "#111827";
  if (intent.layoutStyle === "friendly") return "#2563eb";
  return "#111827";
}

function readHeadlineBox(intent: PrintProductLayoutIntent, productType: PrintProductProductionType) {
  if (productType === "banner") {
    if (intent.textAlignment === "left") return { x: 10, y: 24, width: 62, height: 16 };
    return { x: 12, y: 22, width: 76, height: 16 };
  }

  if (intent.textAlignment === "left") return { x: 12, y: 24, width: 68, height: 12 };
  return { x: 14, y: 24, width: 72, height: 12 };
}

function readBodyBox(intent: PrintProductLayoutIntent, productType: PrintProductProductionType) {
  if (productType === "banner") {
    if (intent.spacing === "compact") return { x: 12, y: 45, width: 76, height: 18 };
    if (intent.textAlignment === "left") return { x: 10, y: 46, width: 60, height: 18 };
    return { x: 18, y: 46, width: 64, height: 18 };
  }

  if (intent.spacing === "compact") return { x: 12, y: 42, width: 76, height: 22 };
  if (intent.textAlignment === "left") return { x: 12, y: 44, width: 62, height: 20 };
  return { x: 18, y: 44, width: 64, height: 20 };
}

function readLogoBox(intent: PrintProductLayoutIntent, productType: PrintProductProductionType) {
  const highPriority = intent.logoPriority === "high";

  if (productType === "banner") {
    if (intent.textAlignment === "left") return highPriority ? { x: 72, y: 16, width: 20, height: 14 } : { x: 76, y: 18, width: 14, height: 10 };
    return highPriority ? { x: 39, y: 7, width: 22, height: 12 } : { x: 42, y: 8, width: 16, height: 10 };
  }

  if (intent.textAlignment === "left") return highPriority ? { x: 72, y: 12, width: 18, height: 12 } : { x: 76, y: 12, width: 14, height: 9 };
  return highPriority ? { x: 39, y: 8, width: 22, height: 12 } : { x: 42, y: 9, width: 16, height: 9 };
}

function updateField(field: PrintProductProductionField, intent: PrintProductLayoutIntent, context: LayoutRequestContext): PrintProductProductionField {
  const color = readTextColor(intent);
  const align = intent.textAlignment;

  if (field.id === "headline" || field.id.startsWith("headline-")) {
    return { ...field, visible: true, box: readHeadlineBox(intent, context.productType), align, color, fontWeight: "bold", italic: false, fontFamily: intent.layoutStyle === "minimal_luxury" ? "serif" : "sans" };
  }

  if (field.id === "body" || field.id.startsWith("body-")) {
    return { ...field, visible: Boolean(field.value.trim() || context.prompt.trim()), box: readBodyBox(intent, context.productType), align, color: intent.layoutStyle === "minimal_luxury" ? "#111827" : color, fontWeight: "regular", italic: false, fontFamily: intent.layoutStyle === "minimal_luxury" ? "serif" : "sans" };
  }

  if (field.id === "phone" || field.id === "website" || field.id === "address") {
    const index = field.id === "phone" ? 0 : field.id === "website" ? 1 : 2;
    const rowY = context.productType === "banner" ? 72 : 76;
    return { ...field, visible: Boolean(field.value.trim()), box: { x: 12 + index * 26, y: rowY, width: 24, height: 7 }, align: "center", color: "#111827", fontWeight: "regular", fontFamily: "sans" };
  }

  if (field.id === "qrCode") {
    return { ...field, box: { x: 84, y: 78, width: 10, height: 10 } };
  }

  return { ...field, align, color };
}

export function applyPrintProductLayoutIntent(context: LayoutRequestContext, intent: PrintProductLayoutIntent): PrintProductProductionLayout {
  const baseLayout = normalizePrintProductLayout(context.baseLayout);
  const adapter = printProductAdapters[context.productType];
  const size = adapter.sizes.find((item) => item.id === baseLayout.sizeId) ?? adapter.sizes[0];

  return normalizePrintProductLayout({
    ...baseLayout,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    backgroundColor: intent.layoutStyle === "minimal_luxury" ? "#f8f3e7" : intent.layoutStyle === "bold_promo" ? "#fff7ed" : intent.layoutStyle === "friendly" ? "#eff6ff" : "#ffffff",
    logo: { ...baseLayout.logo, visible: true, box: readLogoBox(intent, context.productType), assetType: baseLayout.logo.assetType },
    fields: baseLayout.fields.map((field) => updateField(field, intent, context)),
  });
}
