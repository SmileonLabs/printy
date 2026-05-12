import "server-only";

import { businessCardTemplateIconArtwork, defaultBusinessCardTemplateLayout } from "@/lib/business-card-templates";
import { adminCanvasReferenceWidthPx, backgroundColor, boxStyleText, businessCardContactItemGapPx, businessCardIconChromeStyle, businessCardInfoBlockIconSvgPreserveAspectRatio, businessCardInfoBlockIconTextGapStylePx, businessCardTrimWidthScale, displayBusinessCardFieldValue, estimatedBusinessCardTextWidthEm, fittedBusinessCardFontSizePx, fontFamilies, formatPercent, getBusinessCardInfoBlockRenderMetrics, getBusinessCardInfoBlockRowRenderMetrics, getBusinessCardTrimMetrics, readSafeColor, resolveBusinessCardContactLayout, sampleBusinessCardFieldValues, type BusinessCardContactRow, type BusinessCardInfoBlock } from "@/lib/business-card-rendering";
import type { BusinessCardTemplateBackground, BusinessCardTemplateBox, BusinessCardTemplateIconElement, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateSideId, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId, Member, PrintTemplate, ResolvedLogoOption } from "@/lib/types";

export type PrintShopBusinessCardRenderData = {
  brandName: string;
  category: string;
  member: Member;
  logo?: ResolvedLogoOption;
};

type PrintShopBusinessCardHtmlInput = {
  template: PrintTemplate;
  origin?: string;
  includeProductionMarks?: boolean;
  renderData?: PrintShopBusinessCardRenderData;
};

type PrintShopBusinessCardHtmlResult = {
  html: string;
  notes: string[];
  mediaWidthMm: number;
  mediaHeightMm: number;
};

const sideIds: BusinessCardTemplateSideId[] = ["front", "back"];
const sideLabels: Record<BusinessCardTemplateSideId, string> = { front: "Front", back: "Back" };
const bleedMm = 3;

export function createDefaultPrintShopBusinessCardRenderData(): PrintShopBusinessCardRenderData {
  return {
    brandName: "프린티 스튜디오",
    category: "카페",
    member: {
      id: "preview-member",
      name: "김하린",
      role: "대표",
      phone: "010-2480-1190",
      mainPhone: "",
      fax: "",
      email: "",
      website: "",
      address: "",
    },
  };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "").replace(/\r/g, "")}")`;
}

function absoluteAssetUrl(url: string, origin: string | undefined) {
  const trimmed = url.trim();

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (!origin) {
    return trimmed;
  }

  return new URL(trimmed, origin).toString();
}

function backgroundImageStyle(background: BusinessCardTemplateBackground, origin: string | undefined) {
  if (!background.enabled || background.type !== "image" || background.imageUrl.trim().length === 0) {
    return "";
  }

  return `background-image:${cssUrl(absoluteAssetUrl(background.imageUrl, origin))};`;
}

function logoMarkup(logo: ResolvedLogoOption | undefined, origin: string | undefined) {
  if (!logo) {
    return `<img src="${escapeHtml(absoluteAssetUrl("/printy_logo.svg", origin))}" alt="Printy" />`;
  }

  if ("imageUrl" in logo) {
    return `<img src="${escapeHtml(absoluteAssetUrl(logo.imageUrl, origin))}" alt="${escapeHtml(logo.name)}" />`;
  }

  const shapeClass = `logo-shape logo-shape-${logo.shape}`;

  return `<div class="${escapeHtml(shapeClass)}" style="background:${escapeHtml(logo.background)};color:${escapeHtml(logo.accent)};"><span>${escapeHtml(logo.initial)}</span></div>`;
}

function renderLogo(box: BusinessCardTemplateBox, visible: boolean, origin: string | undefined, logo: ResolvedLogoOption | undefined) {
  if (!visible) {
    return "";
  }

  return `<div class="logo" style="${escapeHtml(boxStyleText(box))}">${logoMarkup(logo, origin)}</div>`;
}

function fieldValue(fieldId: BusinessCardTemplateTextFieldId, renderData: PrintShopBusinessCardRenderData | undefined) {
  if (!renderData) {
    return sampleBusinessCardFieldValues[fieldId];
  }

  const values: Record<BusinessCardTemplateTextFieldId, string> = {
    role: renderData.member.role || renderData.category,
    name: renderData.member.name || renderData.brandName,
    phone: renderData.member.phone,
    mainPhone: renderData.member.mainPhone,
    fax: renderData.member.fax,
    email: renderData.member.email,
    website: renderData.member.website ?? "",
    address: renderData.member.address,
  };

  return values[fieldId];
}

function renderField(field: BusinessCardTemplateTextElement, cssPixelScale: number, trimWidthScale: number, renderData: PrintShopBusinessCardRenderData | undefined) {
  const rawValue = field.customValue ?? fieldValue(field.id, renderData);
  const value = displayBusinessCardFieldValue(field.id, rawValue);

  if (!field.visible || value.length === 0) {
    return "";
  }

  const style = `${boxStyleText(field.box)}font-family:${fontFamilies[field.fontFamily]};font-size:${fittedBusinessCardFontSizePx(field, value, cssPixelScale, field.box.width, 16 * cssPixelScale, trimWidthScale)}px;color:${readSafeColor(field.color, "#111827")};font-weight:${field.fontWeight === "bold" ? 900 : 400};font-style:${field.italic || field.fontFamily === "handwriting" ? "italic" : "normal"};text-align:${field.align};--field-padding-x:${formatPercent(8 * cssPixelScale, 4)}px;`;

  return `<div class="field" style="${escapeHtml(style)}"><span>${escapeHtml(value)}</span></div>`;
}

function fieldTextStyle(field: BusinessCardTemplateTextElement, cssPixelScale: number, trimWidthScale: number, value?: string, availableWidthPercent = field.box.width, paddingPx = 0) {
  const fontSizePx = value === undefined ? formatPercent(field.fontSize * cssPixelScale, 8) : fittedBusinessCardFontSizePx(field, value, cssPixelScale, availableWidthPercent, paddingPx, trimWidthScale);

  return `font-family:${fontFamilies[field.fontFamily]};font-size:${fontSizePx}px;color:${readSafeColor(field.color, "#111827")};font-weight:${field.fontWeight === "bold" ? 900 : 400};font-style:${field.italic || field.fontFamily === "handwriting" ? "italic" : "normal"};text-align:${field.align};`;
}

function justifyContentForTextAlign(align: BusinessCardTemplateTextElement["align"]) {
  if (align === "center") {
    return "center";
  }

  if (align === "right") {
    return "flex-end";
  }

  return "flex-start";
}

function contactRowFontScale(row: BusinessCardContactRow, cssPixelScale: number, trimWidthScale: number, availableWidthPercent: number, gapPx: number, paddingPx: number) {
  if (row.id !== "contact" || row.items.length <= 1) {
    return 1;
  }

  const availableWidthPx = Math.max(1, (adminCanvasReferenceWidthPx * cssPixelScale * trimWidthScale * (availableWidthPercent / 100) - paddingPx) * 0.99);
  const totalGapPx = gapPx * (row.items.length - 1);
  const totalTextWidthPx = row.items.reduce((total, item) => total + estimatedBusinessCardTextWidthEm(item.value) * item.field.fontSize * cssPixelScale, 0);

  return totalTextWidthPx + totalGapPx > availableWidthPx ? Math.max(0.1, (availableWidthPx - totalGapPx) / totalTextWidthPx) : 1;
}

function renderInfoBlock(block: BusinessCardInfoBlock, cssPixelScale: number, trimWidthScale: number) {
  const firstField = block.rows[0]?.items[0]?.field;

  if (!firstField) {
    return "";
  }

  const metrics = getBusinessCardInfoBlockRenderMetrics(block);
  const firstRowMetrics = block.rows[0] ? getBusinessCardInfoBlockRowRenderMetrics(block, block.rows[0]) : undefined;
  const iconTopPercent = firstRowMetrics ? firstRowMetrics.topPercent + firstRowMetrics.heightPercent / 2 : 50;
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);
  const iconMarkup = block.icon
    ? (() => {
        const artwork = businessCardTemplateIconArtwork[block.icon.icon];
        const style = `left:${formatPercent(metrics.iconLeftPercent, 0)}%;top:${formatPercent(iconTopPercent, 50)}%;transform:translateY(-50%);width:${formatPercent(metrics.iconWidthPercent, 0)}%;height:${formatPercent(metrics.iconHeightPercent, 0)}%;color:${readSafeColor(block.icon.color, "#075dcb")};--icon-border-width:${iconChrome.borderWidthPx}px;--icon-padding:${iconChrome.paddingPx}px;`;
        return `<span class="info-block-icon" style="${escapeHtml(style)}"><svg viewBox="${escapeHtml(artwork.viewBox)}" preserveAspectRatio="${escapeHtml(businessCardInfoBlockIconSvgPreserveAspectRatio)}" aria-hidden="true"><path d="${escapeHtml(artwork.path)}" fill="currentColor"></path></svg></span>`;
      })()
    : "";
  const iconTextGapPx = block.icon ? businessCardInfoBlockIconTextGapStylePx(block) : 0;
  const rowLeft = block.icon ? `calc(${formatPercent(metrics.iconTextPaddingPercent, 0)}% + ${iconTextGapPx}px)` : `${formatPercent(metrics.paddingLeftPercent, 0)}%`;
  const rowsMarkup = block.rows.map((row) => {
    const rowMetrics = getBusinessCardInfoBlockRowRenderMetrics(block, row);
    const rowAvailableWidthPercent = Math.max(1, 100 - (block.icon ? metrics.iconTextPaddingPercent : metrics.paddingLeftPercent));
    const rowAvailableCanvasWidthPercent = block.box.width * (rowAvailableWidthPercent / 100);
    const contactFontScale = contactRowFontScale(row, cssPixelScale, trimWidthScale, rowAvailableCanvasWidthPercent, row.id === "contact" ? businessCardContactItemGapPx : 0, iconTextGapPx);
    const contactGapReservePercent = row.id === "contact" ? Math.min(rowAvailableWidthPercent - 1, row.items.length * 3) : 0;
    const itemAvailableWidthPercent = Math.max(1, block.box.width * ((rowAvailableWidthPercent - contactGapReservePercent) / 100) / row.items.length);
    const rowStyle = `left:${rowLeft};right:0;top:${formatPercent(rowMetrics.topPercent, 0)}%;height:${formatPercent(rowMetrics.heightPercent, 100)}%;gap:${row.id === "contact" ? `${businessCardContactItemGapPx}px` : "0.35em"};justify-content:${justifyContentForTextAlign(firstField.align)};`;

    return `<span class="info-block-row" style="${escapeHtml(rowStyle)}">${row.items.map((item) => {
      const itemStyle = row.id === "contact" ? `${fieldTextStyle(item.field, cssPixelScale, trimWidthScale, item.value, itemAvailableWidthPercent)}font-size:${formatPercent(item.field.fontSize * cssPixelScale * contactFontScale, item.field.fontSize * cssPixelScale)}px;` : fieldTextStyle(item.field, cssPixelScale, trimWidthScale, item.value, itemAvailableWidthPercent, iconTextGapPx);

      return `<span class="info-block-item" style="${escapeHtml(itemStyle)}">${escapeHtml(item.value)}</span>`;
    }).join("")}</span>`;
  }).join("");
  const textPadding = block.icon ? `calc(${formatPercent(metrics.iconTextPaddingPercent, 0)}% + ${businessCardInfoBlockIconTextGapStylePx(block)}px)` : `${formatPercent(metrics.paddingLeftPercent, 0)}%`;
  const style = `${boxStyleText(block.box)}${fieldTextStyle(firstField, cssPixelScale, trimWidthScale)}--contact-padding-left:${textPadding};`;

  return `<div class="info-block" style="${escapeHtml(style)}">${iconMarkup}${rowsMarkup}</div>`;
}

function renderLine(line: BusinessCardTemplateLineElement) {
  if (!line.visible) {
    return "";
  }

  const style = `${boxStyleText(line.box)}background-color:${readSafeColor(line.color, "#111827")};`;

  return `<div class="line" style="${escapeHtml(style)}"></div>`;
}

function renderIcon(icon: BusinessCardTemplateIconElement, cssPixelScale: number) {
  if (!icon.visible) {
    return "";
  }

  const artwork = businessCardTemplateIconArtwork[icon.icon];
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);
  const style = `${boxStyleText(icon.box)}color:${readSafeColor(icon.color, "#075dcb")};--icon-border-width:${iconChrome.borderWidthPx}px;--icon-padding:${iconChrome.paddingPx}px;`;

  return `<div class="icon" style="${escapeHtml(style)}"><svg viewBox="${escapeHtml(artwork.viewBox)}" aria-hidden="true"><path d="${escapeHtml(artwork.path)}" fill="currentColor"></path></svg></div>`;
}

function renderCropMarks() {
  return `<div class="crop crop-top-left-x"></div><div class="crop crop-top-left-y"></div><div class="crop crop-top-right-x"></div><div class="crop crop-top-right-y"></div><div class="crop crop-bottom-left-x"></div><div class="crop crop-bottom-left-y"></div><div class="crop crop-bottom-right-x"></div><div class="crop crop-bottom-right-y"></div>`;
}

function renderSide(layout: BusinessCardTemplateLayout, sideId: BusinessCardTemplateSideId, origin: string | undefined, cssPixelScale: number, includeProductionMarks: boolean, renderData: PrintShopBusinessCardRenderData | undefined) {
  const side = layout.sides[sideId];
  const trimWidthScale = businessCardTrimWidthScale(layout.canvas.trim);
  const backgroundStyle = `background-color:${backgroundColor(side.background)};${backgroundImageStyle(side.background, origin)}`;
  const cropMarks = includeProductionMarks ? renderCropMarks() : "";
  const contactLayout = resolveBusinessCardContactLayout(side.fields, side.icons, (field) => field.customValue ?? fieldValue(field.id, renderData));

  return `<section class="pdf-page" data-side="${sideId}" aria-label="${sideLabels[sideId]}"><div class="bleed-background" style="${escapeHtml(backgroundStyle)}"></div><article class="trim-area">${renderLogo(side.logo.box, side.logo.visible, origin, renderData?.logo)}${side.lines.map(renderLine).join("")}${contactLayout.blocks.map((block) => renderInfoBlock(block, cssPixelScale, trimWidthScale)).join("")}${contactLayout.fields.map((field) => renderField(field, cssPixelScale, trimWidthScale, renderData)).join("")}${contactLayout.icons.map((icon) => renderIcon(icon, cssPixelScale)).join("")}</article>${cropMarks}</section>`;
}

export function buildPrintShopBusinessCardHtml({ template, origin, includeProductionMarks = false, renderData }: PrintShopBusinessCardHtmlInput): PrintShopBusinessCardHtmlResult {
  const layout = template.layout ?? defaultBusinessCardTemplateLayout;
  const { trimWidthMm, trimHeightMm, cssPixelScale } = getBusinessCardTrimMetrics(layout.canvas.trim);
  const pageBleedMm = includeProductionMarks ? bleedMm : 0;
  const mediaWidthMm = trimWidthMm + pageBleedMm * 2;
  const mediaHeightMm = trimHeightMm + pageBleedMm * 2;
  const title = escapeHtml(template.title.trim() || "Printy business card");
  const notes = [
    "Rendered by Chromium from Printy's standalone business-card HTML/SVG/CSS print path using the admin canvas percent-box conventions.",
    includeProductionMarks ? `Trim ${trimWidthMm}mm x ${trimHeightMm}mm with ${bleedMm}mm bleed and crop marks.` : `Trim-only ${trimWidthMm}mm x ${trimHeightMm}mm canvas parity PDF without bleed or crop marks.`,
    "This PDF is a browser-rendered print-shop handoff helper; it is not PDF/X, not CMYK, and not preflight certified.",
  ];

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - Printy print-shop handoff</title>
  <style>
    @page { size: ${mediaWidthMm}mm ${mediaHeightMm}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: "Noto Sans KR", "Nanum Gothic", "Apple SD Gothic Neo", sans-serif; }
    body { width: ${mediaWidthMm}mm; }
    .pdf-page { position: relative; width: ${mediaWidthMm}mm; height: ${mediaHeightMm}mm; overflow: hidden; break-after: page; page-break-after: always; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .pdf-page:last-child { break-after: auto; page-break-after: auto; }
    .bleed-background { position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center; background-repeat: no-repeat; }
    .trim-area { position: absolute; z-index: 1; left: ${pageBleedMm}mm; top: ${pageBleedMm}mm; width: ${trimWidthMm}mm; height: ${trimHeightMm}mm; overflow: hidden; }
    .logo { position: absolute; z-index: 2; overflow: hidden; }
    .logo img { position: absolute; inset: 1mm; display: block; width: calc(100% - 2mm); height: calc(100% - 2mm); object-fit: contain; }
    .logo-shape { position: absolute; inset: 1mm; display: grid; width: calc(100% - 2mm); height: calc(100% - 2mm); place-items: center; border: 0.2mm solid #e4eaf3; font-weight: 900; font-size: 8mm; line-height: 1; }
    .logo-shape span { display: block; }
    .logo-shape-circle, .logo-shape-pill { border-radius: 999mm; }
    .logo-shape-square, .logo-shape-spark { border-radius: 2mm; }
    .logo-shape-diamond { transform: rotate(45deg) scale(0.72); border-radius: 1.5mm; }
    .logo-shape-diamond span { transform: rotate(-45deg); }
    .logo-shape-arch { border-radius: 999mm 999mm 2mm 2mm; }
    .logo-shape-spark::after { content: ""; position: absolute; right: 12%; top: 12%; width: 12%; height: 12%; border-radius: 999mm; background: currentColor; }
    .field { position: absolute; z-index: 2; display: flex; align-items: center; overflow: hidden; line-height: 1.3; padding: 0 var(--field-padding-x); }
    .field span { display: block; width: 100%; overflow: hidden; white-space: nowrap; }
    .info-block { position: absolute; z-index: 2; overflow: visible; line-height: 1.3; }
    .info-block-icon { position: absolute; display: flex; justify-content: flex-end; align-items: center; overflow: visible; border: var(--icon-border-width) solid transparent; padding: var(--icon-padding); }
    .info-block-icon svg { display: block; width: 100%; height: 100%; }
    .info-block-row { position: absolute; display: flex; min-width: 0; align-items: center; overflow: hidden; white-space: nowrap; }
    .info-block-item { flex: 0 0 auto; overflow: visible; }
    .icon { position: absolute; z-index: 2; overflow: hidden; border: var(--icon-border-width) solid transparent; padding: var(--icon-padding); }
    .icon svg { display: block; width: 100%; height: 100%; }
    .line { position: absolute; z-index: 2; min-width: 0.25px; min-height: 0.25px; }
    .crop { position: absolute; z-index: 3; background: #000000; }
    .crop-top-left-x, .crop-top-right-x, .crop-bottom-left-x, .crop-bottom-right-x { width: 4mm; height: 0.12mm; }
    .crop-top-left-y, .crop-top-right-y, .crop-bottom-left-y, .crop-bottom-right-y { width: 0.12mm; height: 4mm; }
    .crop-top-left-x { left: 0; top: ${pageBleedMm}mm; }
    .crop-top-left-y { left: ${pageBleedMm}mm; top: 0; }
    .crop-top-right-x { right: 0; top: ${pageBleedMm}mm; }
    .crop-top-right-y { right: ${pageBleedMm}mm; top: 0; }
    .crop-bottom-left-x { left: 0; bottom: ${pageBleedMm}mm; }
    .crop-bottom-left-y { left: ${pageBleedMm}mm; bottom: 0; }
    .crop-bottom-right-x { right: 0; bottom: ${pageBleedMm}mm; }
    .crop-bottom-right-y { right: ${pageBleedMm}mm; bottom: 0; }
  </style>
</head>
<body>
  ${sideIds.map((sideId) => renderSide(layout, sideId, origin, cssPixelScale, includeProductionMarks, renderData)).join("\n")}
</body>
</html>`;

  return { html, notes, mediaWidthMm, mediaHeightMm };
}
