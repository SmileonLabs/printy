import "server-only";

import type { AiBusinessCardCleanBackgrounds } from "@/lib/ai-business-card/backgrounds";
import { getAiBusinessCardIconArtwork } from "@/lib/ai-business-card/icons";
import type { AiBusinessCardDesign, AiBusinessCardElement, AiBusinessCardIconElement, AiBusinessCardImageElement, AiBusinessCardInput, AiBusinessCardSideId } from "@/lib/ai-business-card/schema";
import { renderTextElementAsOutline } from "@/lib/ai-business-card/text-outlines";
import { readBrandAssetBytesByPublicUrl } from "@/lib/server/storage";

export type AiBusinessCardHtmlResult = {
  html: string;
  mediaWidthMm: number;
  mediaHeightMm: number;
  notes: string[];
};

const sideIds: AiBusinessCardSideId[] = ["front", "back"];
const sideLabels: Record<AiBusinessCardSideId, string> = { front: "Front", back: "Back" };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "").replace(/\r/g, "")}")`;
}

function absoluteAssetUrl(url: string, origin: string | undefined) {
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }

  return origin ? new URL(url, origin).toString() : url;
}

async function cleanBackgroundDataUrl(publicUrl: string) {
  if (publicUrl.startsWith("data:")) {
    return publicUrl;
  }

  const bytes = await readBrandAssetBytesByPublicUrl(publicUrl);

  return bytes ? `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` : publicUrl;
}

function renderCropMarks(bleedMm: number) {
  return `<div class="crop crop-top-left-x"></div><div class="crop crop-top-left-y"></div><div class="crop crop-top-right-x"></div><div class="crop crop-top-right-y"></div><div class="crop crop-bottom-left-x"></div><div class="crop crop-bottom-left-y"></div><div class="crop crop-bottom-right-x"></div><div class="crop crop-bottom-right-y"></div><style>.crop-top-left-x{left:0;top:${bleedMm}mm}.crop-top-left-y{left:${bleedMm}mm;top:0}.crop-top-right-x{right:0;top:${bleedMm}mm}.crop-top-right-y{right:${bleedMm}mm;top:0}.crop-bottom-left-x{left:0;bottom:${bleedMm}mm}.crop-bottom-left-y{left:${bleedMm}mm;bottom:0}.crop-bottom-right-x{right:0;bottom:${bleedMm}mm}.crop-bottom-right-y{right:${bleedMm}mm;bottom:0}</style>`;
}

function renderIconElement(element: AiBusinessCardIconElement) {
  const artwork = getAiBusinessCardIconArtwork(element.icon);
  const style = `left:${element.xMm}mm;top:${element.yMm}mm;width:${element.widthMm}mm;height:${element.heightMm}mm;color:${escapeHtml(element.color)};z-index:${element.layer};`;

  return `<svg class="vector-icon" style="${style}" xmlns="http://www.w3.org/2000/svg" viewBox="${escapeHtml(artwork.viewBox)}" aria-hidden="true"><path d="${escapeHtml(artwork.path)}" fill="currentColor"></path></svg>`;
}

function renderImageElement(element: AiBusinessCardImageElement, origin: string | undefined) {
  const objectFit = element.fit === "cover" ? "cover" : "contain";
  const style = `left:${element.xMm}mm;top:${element.yMm}mm;width:${element.widthMm}mm;height:${element.heightMm}mm;object-fit:${objectFit};opacity:${element.opacity ?? 1};z-index:${element.layer};`;

  return `<img class="placed-image" src="${escapeHtml(absoluteAssetUrl(element.src, origin))}" style="${style}" alt="" />`;
}

function shouldRenderElement(element: AiBusinessCardElement, hasCleanBackground: boolean) {
  if (element.type === "text") {
    return !hasCleanBackground || (element.field !== "brandName" && element.field !== "category");
  }

  return element.type === "icon" || element.type === "image" || !hasCleanBackground;
}

async function renderVectorElement(element: AiBusinessCardElement, input: AiBusinessCardInput, origin: string | undefined) {
  if (element.type === "text") {
    return renderTextElementAsOutline(element, input);
  }

  if (element.type === "icon") {
    return renderIconElement(element);
  }

  if (element.type === "image") {
    return renderImageElement(element, origin);
  }

  return "";
}

async function renderSide(design: AiBusinessCardDesign, sideId: AiBusinessCardSideId, input: AiBusinessCardInput, origin: string | undefined, includeProductionMarks: boolean, cleanBackgrounds?: AiBusinessCardCleanBackgrounds) {
  const side = design.sides[sideId];
  const bleedMm = includeProductionMarks ? design.canvas.bleedMm : 0;
  const cleanBackground = cleanBackgrounds?.[sideId];
  const cleanBackgroundUrl = cleanBackground ? await cleanBackgroundDataUrl(cleanBackground) : undefined;
  const backgroundImage = cleanBackgroundUrl ? `background-image:${cssUrl(absoluteAssetUrl(cleanBackgroundUrl, origin))};background-size:100% 100%;` : side.background.image ? `background-image:${cssUrl(absoluteAssetUrl(side.background.image.src, origin))};background-size:100% 100%;opacity:${side.background.image.opacity ?? 1};` : "";
  const elements = (await Promise.all(side.elements
    .filter((element) => shouldRenderElement(element, Boolean(cleanBackground)))
    .sort((left, right) => left.layer - right.layer)
    .map((element) => renderVectorElement(element, input, origin)))).join("");

  return `<section class="pdf-page" aria-label="${sideLabels[sideId]}"><div class="bleed-background" style="background-color:${escapeHtml(side.background.color)};${escapeHtml(backgroundImage)}"></div><article class="trim-area" style="left:${bleedMm}mm;top:${bleedMm}mm;width:${design.canvas.widthMm}mm;height:${design.canvas.heightMm}mm;">${elements}</article>${includeProductionMarks ? renderCropMarks(bleedMm) : ""}</section>`;
}

export async function buildAiBusinessCardHtml(design: AiBusinessCardDesign, input: AiBusinessCardInput, options: { origin?: string; includeProductionMarks?: boolean; cleanBackgrounds?: AiBusinessCardCleanBackgrounds } = {}): Promise<AiBusinessCardHtmlResult> {
  const bleedMm = options.includeProductionMarks ? design.canvas.bleedMm : 0;
  const mediaWidthMm = design.canvas.widthMm + bleedMm * 2;
  const mediaHeightMm = design.canvas.heightMm + bleedMm * 2;
  const notes = [
    "Rendered from validated Printy AI business-card JSON.",
    `Exact ${design.canvas.widthMm}mm x ${design.canvas.heightMm}mm PDF with no extra bleed or crop marks.`,
    "Customer input is injected at render time; AI mockup text is not trusted as final data.",
    "All final text fields are rendered as SVG path outlines, not PDF text objects.",
  ];
  const sides = (await Promise.all(sideIds.map((sideId) => renderSide(design, sideId, input, options.origin, options.includeProductionMarks ?? true, options.cleanBackgrounds)))).join("\n");
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Printy AI business card</title><style>@page{size:${mediaWidthMm}mm ${mediaHeightMm}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111}body{width:${mediaWidthMm}mm}.pdf-page{position:relative;width:${mediaWidthMm}mm;height:${mediaHeightMm}mm;overflow:hidden;break-after:page;page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact}.pdf-page:last-child{break-after:auto;page-break-after:auto}.bleed-background{position:absolute;inset:-.25mm;z-index:0;background-position:center;background-repeat:no-repeat}.trim-area{position:absolute;z-index:1;overflow:hidden}.text-outline,.vector-icon,.placed-image{position:absolute;left:0;top:0;overflow:visible}.text-outline{width:100%;height:100%}.crop{position:absolute;z-index:99;background:#000}.crop-top-left-x,.crop-top-right-x,.crop-bottom-left-x,.crop-bottom-right-x{width:4mm;height:.12mm}.crop-top-left-y,.crop-top-right-y,.crop-bottom-left-y,.crop-bottom-right-y{width:.12mm;height:4mm}</style></head><body>${sides}</body></html>`;

  return { html, mediaWidthMm, mediaHeightMm, notes };
}
