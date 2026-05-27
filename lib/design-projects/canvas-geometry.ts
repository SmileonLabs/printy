import type { CSSProperties } from "react";
import type { DesignBox } from "@/lib/design-projects/types";

export type CanvasResizeCorner = "top-left" | "top" | "top-right" | "right" | "bottom-right" | "bottom" | "bottom-left" | "left";
export type CanvasSelectionBox = DesignBox;

export function clampCanvasValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function roundCanvasPercent(value: number) {
  return Number(value.toFixed(2));
}

export function snapCanvasPercent(value: number, gridStep: number) {
  return roundCanvasPercent(Math.round(value / gridStep) * gridStep);
}

export function canvasBoxStyle(box: DesignBox): CSSProperties {
  return { left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` };
}

export function moveCanvasBox(box: DesignBox, deltaX: number, deltaY: number, options: { snapGridStep?: number; minX?: number; maxX?: number; minY?: number; maxY?: number } = {}): DesignBox {
  const nextX = box.x + deltaX;
  const nextY = box.y + deltaY;
  const x = options.snapGridStep ? snapCanvasPercent(nextX, options.snapGridStep) : nextX;
  const y = options.snapGridStep ? snapCanvasPercent(nextY, options.snapGridStep) : nextY;

  return { ...box, x: roundCanvasPercent(clampCanvasValue(x, options.minX ?? 0, options.maxX ?? 100 - box.width)), y: roundCanvasPercent(clampCanvasValue(y, options.minY ?? 0, options.maxY ?? 100 - box.height)) };
}

export function resizeCanvasBox(box: DesignBox, corner: CanvasResizeCorner, deltaX: number, deltaY: number, options: { minSize?: number; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number; snapGridStep?: number } = {}): DesignBox {
  const minWidth = options.minWidth ?? options.minSize ?? 1;
  const maxWidth = options.maxWidth ?? 100;
  const minHeight = options.minHeight ?? options.minSize ?? 1;
  const maxHeight = options.maxHeight ?? 100;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const snap = (value: number) => options.snapGridStep ? snapCanvasPercent(value, options.snapGridStep) : value;
  const isLeft = corner === "top-left" || corner === "bottom-left" || corner === "left";
  const isRight = corner === "top-right" || corner === "bottom-right" || corner === "right";
  const isTop = corner === "top-left" || corner === "top-right" || corner === "top";
  const isBottom = corner === "bottom-left" || corner === "bottom-right" || corner === "bottom";
  const isCorner = corner === "top-left" || corner === "top-right" || corner === "bottom-left" || corner === "bottom-right";
  let nextX = box.x;
  let nextY = box.y;
  let nextWidth = box.width;
  let nextHeight = box.height;

  if (isCorner) {
    const aspectRatio = box.width / box.height;
    const proposedWidth = isLeft ? right - snap(box.x + deltaX) : snap(box.width + deltaX);
    const proposedHeight = isTop ? bottom - snap(box.y + deltaY) : snap(box.height + deltaY);
    const useWidth = Math.abs(proposedWidth - box.width) >= Math.abs(proposedHeight - box.height) * aspectRatio;
    const widthLimit = Math.min(maxWidth, maxHeight * aspectRatio);
    const width = clampCanvasValue(useWidth ? proposedWidth : proposedHeight * aspectRatio, minWidth, Math.max(minWidth, widthLimit));
    const height = width / aspectRatio;

    nextWidth = width;
    nextHeight = height;
    nextX = isLeft ? right - width : box.x;
    nextY = isTop ? bottom - height : box.y;

    return { x: roundCanvasPercent(nextX), y: roundCanvasPercent(nextY), width: roundCanvasPercent(nextWidth), height: roundCanvasPercent(nextHeight) };
  }

  if (isLeft) {
    nextWidth = clampCanvasValue(right - snap(box.x + deltaX), minWidth, maxWidth);
    nextX = right - nextWidth;
  } else if (isRight) {
    nextWidth = clampCanvasValue(snap(box.width + deltaX), minWidth, maxWidth);
  }

  if (isTop) {
    nextHeight = clampCanvasValue(bottom - snap(box.y + deltaY), minHeight, maxHeight);
    nextY = bottom - nextHeight;
  } else if (isBottom) {
    nextHeight = clampCanvasValue(snap(box.height + deltaY), minHeight, maxHeight);
  }

  return { x: roundCanvasPercent(nextX), y: roundCanvasPercent(nextY), width: roundCanvasPercent(nextWidth), height: roundCanvasPercent(nextHeight) };
}

export function resizeCanvasTextBoxToContent(box: DesignBox, corner: CanvasResizeCorner, deltaX: number, deltaY: number, options: { pageWidthMm: number; pageHeightMm: number; value: string | undefined; minSize?: number; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number; snapGridStep?: number }): DesignBox {
  return resizeCanvasBox(box, corner, deltaX, deltaY, { minSize: options.minSize, minWidth: options.minWidth, maxWidth: options.maxWidth, minHeight: options.minHeight, maxHeight: options.maxHeight, snapGridStep: options.snapGridStep });
}

export function updateCanvasBoxValue(box: DesignBox, key: keyof DesignBox, value: number, options: { minSize?: number; minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number; minX?: number; maxX?: number; minY?: number; maxY?: number } = {}): DesignBox {
  if (!Number.isFinite(value)) {
    return box;
  }

  const minWidth = options.minWidth ?? options.minSize ?? 1;
  const maxWidth = options.maxWidth ?? 100;
  const minHeight = options.minHeight ?? options.minSize ?? 1;
  const maxHeight = options.maxHeight ?? 100;
  if (key === "x") return { ...box, x: roundCanvasPercent(clampCanvasValue(value, options.minX ?? 0, options.maxX ?? 100 - box.width)) };
  if (key === "y") return { ...box, y: roundCanvasPercent(clampCanvasValue(value, options.minY ?? 0, options.maxY ?? 100 - box.height)) };
  if (key === "width") return { ...box, width: roundCanvasPercent(clampCanvasValue(value, minWidth, maxWidth)) };
  return { ...box, height: roundCanvasPercent(clampCanvasValue(value, minHeight, maxHeight)) };
}

export function canvasBoxesIntersect(left: DesignBox, right: DesignBox) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

export function readCanvasSelectionBox(points: { startX: number; startY: number; currentX: number; currentY: number }, bounds: DOMRect): CanvasSelectionBox {
  const startX = ((points.startX - bounds.left) / bounds.width) * 100;
  const startY = ((points.startY - bounds.top) / bounds.height) * 100;
  const currentX = ((points.currentX - bounds.left) / bounds.width) * 100;
  const currentY = ((points.currentY - bounds.top) / bounds.height) * 100;
  const x = clampCanvasValue(Math.min(startX, currentX), 0, 100);
  const y = clampCanvasValue(Math.min(startY, currentY), 0, 100);
  const right = clampCanvasValue(Math.max(startX, currentX), 0, 100);
  const bottom = clampCanvasValue(Math.max(startY, currentY), 0, 100);

  return { x, y, width: right - x, height: bottom - y };
}
