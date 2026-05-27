import type { CSSProperties } from "react";
import { boxStyle as percentBoxStyle, fontFamilies } from "@/lib/business-card-rendering";
import type { DesignBackground, DesignBox, DesignElement, DesignLayout, DesignPage, DesignTextElement } from "@/lib/design-projects/types";
import { designTextBoxFontSizeCss, designTextLineHeight } from "@/lib/design-projects/text-sizing";
import { textColorStyle } from "@/lib/text-color-effects";

export type DesignElementValues = Record<string, string | undefined>;

export function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "").replace(/\r/g, "")}")`;
}

export function designBoxStyle(box: DesignBox): CSSProperties {
  return percentBoxStyle(box);
}

export function designLayoutAspectRatio(layout: DesignLayout) {
  const pageCount = Math.max(layout.pages.length, 1);

  return `${layout.canvas.widthMm} / ${layout.canvas.heightMm * pageCount}`;
}

export function designPageFrameStyle(layout: DesignLayout, pageIndex: number): CSSProperties {
  const pageCount = Math.max(layout.pages.length, 1);

  return {
    top: `${(pageIndex / pageCount) * 100}%`,
    height: `${100 / pageCount}%`,
  };
}

export function designBackgroundStyle(background: DesignBackground): CSSProperties {
  if (background.type === "none") {
    return {};
  }

  if (background.type === "color") {
    return { backgroundColor: background.color };
  }

  return {
    backgroundColor: background.color,
    backgroundImage: cssUrl(background.imageUrl),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
  };
}

export function designCleanMockupPageStyle(cleanImageUrl: string | undefined, layout: DesignLayout, pageIndex: number): CSSProperties {
  if (!cleanImageUrl) {
    return {};
  }

  const pageCount = Math.max(layout.pages.length, 1);

  return {
    backgroundImage: cssUrl(cleanImageUrl),
    backgroundPosition: pageCount === 1 ? "center" : `center ${(pageIndex / Math.max(pageCount - 1, 1)) * 100}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: pageCount === 1 ? "100% 100%" : `100% ${pageCount * 100}%`,
  };
}

export function designTextStyle(element: DesignTextElement, fontScale = 1, value?: string): CSSProperties {
  return {
    ...textColorStyle(element.color),
    fontFamily: fontFamilies[element.fontFamily],
    fontSize: fontScale === 1 ? designTextBoxFontSizeCss(value ?? element.value) : `${element.fontSize * fontScale}px`,
    fontStyle: element.italic ? "italic" : undefined,
    fontWeight: element.fontWeight === "bold" ? 900 : 400,
    lineHeight: designTextLineHeight,
    textAlign: element.align,
  };
}

export function designElementValue(element: DesignElement, values: DesignElementValues = {}) {
  if (element.type !== "text" && element.type !== "qr") {
    return undefined;
  }

  if (element.fieldId && values[element.fieldId]) {
    return values[element.fieldId];
  }

  if (values[element.id]) {
    return values[element.id];
  }

  return element.value;
}

export function visibleDesignElements(page: DesignPage) {
  return page.elements.filter((element) => element.visible);
}
