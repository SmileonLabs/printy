import type { DesignBox } from "@/lib/design-projects/types";

export type DesignTextResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const designTextBoxFontHeightRatio = 0.58;
export const designTextAverageCharacterWidthRatio = 0.62;
export const designTextLineHeight = 1.12;

function characterWidthRatio(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;

  if (/\s/.test(character)) return 0.35;
  if (codePoint > 255) return 1;
  if (/[A-Z0-9]/.test(character)) return 0.68;
  return designTextAverageCharacterWidthRatio;
}

function textLineWidth(line: string) {
  return Array.from(line || " ").reduce((total, character) => total + characterWidthRatio(character), 0);
}

function textMeasure(value: string | undefined) {
  const lines = (value?.trim() ? value : " ").split(/\r?\n/);

  return {
    lineCount: Math.max(1, lines.length),
    maxLineWidth: Math.max(1, ...lines.map(textLineWidth)),
  };
}

export function designTextBoxFontSizeCss(value: string | undefined) {
  const { lineCount, maxLineWidth } = textMeasure(value);

  return `min(${100 / maxLineWidth}cqw, ${100 / (lineCount * designTextLineHeight)}cqh)`;
}

export function designTextBoxFontSizeMm(pageWidthMm: number, pageHeightMm: number, box: DesignBox, value: string | undefined) {
  const { lineCount, maxLineWidth } = textMeasure(value);
  const widthBasedSize = (pageWidthMm * box.width / 100) / maxLineWidth;
  const heightBasedSize = (pageHeightMm * box.height / 100) / (lineCount * designTextLineHeight);

  return Math.max(1, Math.min(widthBasedSize, heightBasedSize));
}

export function designTextBoxFontSizePx(pageWidthPx: number, pageHeightPx: number, box: DesignBox, value: string | undefined) {
  const { lineCount, maxLineWidth } = textMeasure(value);
  const widthBasedSize = (pageWidthPx * box.width / 100) / maxLineWidth;
  const heightBasedSize = (pageHeightPx * box.height / 100) / (lineCount * designTextLineHeight);

  return Math.max(1, Math.min(widthBasedSize, heightBasedSize));
}

export function designTextBoxPercentAspectRatio(pageWidthMm: number, pageHeightMm: number, value: string | undefined) {
  const { lineCount, maxLineWidth } = textMeasure(value);
  const textAspectRatio = maxLineWidth / (lineCount * designTextLineHeight);

  return textAspectRatio * (pageHeightMm / pageWidthMm);
}

export function resizeDesignTextBoxToContentAspectRatio({ box, proposedBox, corner, pageWidthMm, pageHeightMm, value, minSize = 1 }: { box: DesignBox; proposedBox: DesignBox; corner: DesignTextResizeCorner; pageWidthMm: number; pageHeightMm: number; value: string | undefined; minSize?: number }) {
  const aspectRatio = designTextBoxPercentAspectRatio(pageWidthMm, pageHeightMm, value);
  const useWidth = Math.abs(proposedBox.width - box.width) >= Math.abs(proposedBox.height - box.height);
  const minWidth = Math.max(minSize, minSize * aspectRatio);
  const minHeight = Math.max(minSize, minSize / aspectRatio);
  const maxWidth = corner === "top-left" || corner === "bottom-left" ? box.x + box.width : 100 - box.x;
  const maxHeight = corner === "top-left" || corner === "top-right" ? box.y + box.height : 100 - box.y;
  const width = useWidth
    ? Math.min(Math.max(proposedBox.width, minWidth), Math.min(maxWidth, maxHeight * aspectRatio))
    : Math.min(Math.max(proposedBox.height, minHeight), Math.min(maxHeight, maxWidth / aspectRatio)) * aspectRatio;
  const height = width / aspectRatio;

  if (corner === "top-left") {
    return { x: box.x + box.width - width, y: box.y + box.height - height, width, height };
  }

  if (corner === "top-right") {
    return { x: box.x, y: box.y + box.height - height, width, height };
  }

  if (corner === "bottom-left") {
    return { x: box.x + box.width - width, y: box.y, width, height };
  }

  return { x: box.x, y: box.y, width, height };
}
