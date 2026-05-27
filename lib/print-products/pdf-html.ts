import type { PrintProductProductionField, PrintProductProductionLayout } from "@/lib/types";
import { designTextBoxFontSizeMm } from "@/lib/design-projects/text-sizing";
import { textColorCss } from "@/lib/text-color-effects";

const pdfFontFamilies = {
  sans: '"Noto Sans KR","Arial",sans-serif',
  serif: '"Noto Serif CJK KR","Noto Serif KR",serif',
  rounded: '"Gowun Dodum","Noto Sans KR",sans-serif',
  mono: '"Noto Sans Mono CJK KR",monospace',
  display: '"Gowun Dodum","Noto Sans KR",sans-serif',
  handwriting: '"Gowun Dodum","Noto Sans KR",sans-serif',
} as const;

const justifyContentByAlign = { left: "flex-start", center: "center", right: "flex-end" } as const;

type BuildPrintProductPdfHtmlInput = {
  layout: PrintProductProductionLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  origin?: string;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resolveUrl(src: string | undefined, origin: string | undefined) {
  if (!src) {
    return undefined;
  }

  if (/^https?:\/\//i.test(src) || src.startsWith("data:image/")) {
    return src;
  }

  return origin ? new URL(src, origin).toString() : src;
}

function fieldHtml(field: PrintProductProductionField, layout: PrintProductProductionLayout) {
  if (!field.visible || !field.value.trim()) {
    return "";
  }

  if (field.id === "qrCode" && field.value.startsWith("data:image/")) {
    return `<img class="field" src="${escapeHtml(field.value)}" style="left:${field.box.x}%;top:${field.box.y}%;width:${field.box.width}%;height:${field.box.height}%;object-fit:contain;" />`;
  }

  return `<div class="field text" style="left:${field.box.x}%;top:${field.box.y}%;width:${field.box.width}%;height:${field.box.height}%;font-family:${pdfFontFamilies[field.fontFamily ?? "sans"]};font-size:${designTextBoxFontSizeMm(layout.widthMm, layout.heightMm, field.box, field.value)}mm;${textColorCss(field.color)}font-style:${field.italic ? "italic" : "normal"};font-weight:${field.fontWeight === "bold" ? 800 : 500};justify-content:${justifyContentByAlign[field.align]};text-align:${field.align};">${escapeHtml(field.value)}</div>`;
}

function promptShapeHtml(shape: NonNullable<PrintProductProductionLayout["promptShapes"]>[number]) {
  if (!shape.visible) {
    return "";
  }

  return `<div class="prompt-shape" style="left:${shape.box.x}%;top:${shape.box.y}%;width:${shape.box.width}%;height:${shape.box.height}%;background:${shape.fillColor};border-color:${shape.strokeColor};color:${shape.textColor};font-size:${Math.max(3, shape.box.height * 0.35)}mm;">${escapeHtml(shape.glyph)}</div>`;
}

export function buildPrintProductPdfHtml(input: BuildPrintProductPdfHtmlInput) {
  const backgroundUrl = resolveUrl(input.backgroundImageUrl, input.origin);
  const logoUrl = resolveUrl(input.layout.logo.assetType === "svg" ? input.logoVectorSvgUrl || input.logoImageUrl : input.logoImageUrl, input.origin);
  const logo = input.layout.logo.visible && logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" style="left:${input.layout.logo.box.x}%;top:${input.layout.logo.box.y}%;width:${input.layout.logo.box.width}%;height:${input.layout.logo.box.height}%;" />` : "";

  return `<!doctype html><html><head><meta charset="utf-8" /><style>@page{size:${input.layout.widthMm}mm ${input.layout.heightMm}mm;margin:0}html,body{margin:0;width:${input.layout.widthMm}mm;height:${input.layout.heightMm}mm}body{font-family:"Noto Sans KR","Arial",sans-serif}.sheet{position:relative;width:100%;height:100%;overflow:hidden;background:${input.layout.backgroundColor};}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.field,.logo,.prompt-shape{position:absolute;box-sizing:border-box}.text{display:flex;align-items:center;line-height:1.12;white-space:pre;overflow:hidden}.logo{object-fit:contain}.prompt-shape{display:flex;align-items:center;justify-content:center;border:.5mm solid;border-radius:9999px;font-weight:900;line-height:1}</style></head><body><main class="sheet">${backgroundUrl ? `<img class="bg" src="${escapeHtml(backgroundUrl)}" />` : ""}${logo}${(input.layout.promptShapes ?? []).map(promptShapeHtml).join("")}${input.layout.fields.map((field) => fieldHtml(field, input.layout)).join("")}</main></body></html>`;
}
