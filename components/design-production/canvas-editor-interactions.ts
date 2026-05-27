"use client";

import { useRef, useState, type PointerEvent, type RefObject } from "react";

export type CanvasEditorPointerDragBase = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type CanvasEditorPointerDragDelta<T extends CanvasEditorPointerDragBase> = {
  dragState: T;
  deltaX: number;
  deltaY: number;
};

export function isCanvasEditorFormTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function isCanvasEditorInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button,input,textarea,select,label,[role='button']"));
}

export function canvasEditorKeyboardMoveDelta(event: KeyboardEvent, defaultStep = 0.5, shiftedStep = 2.5) {
  const step = event.shiftKey ? shiftedStep : defaultStep;

  if (event.key === "ArrowUp") return { x: 0, y: -step };
  if (event.key === "ArrowDown") return { x: 0, y: step };
  if (event.key === "ArrowLeft") return { x: -step, y: 0 };
  if (event.key === "ArrowRight") return { x: step, y: 0 };
  return undefined;
}

export function isCanvasEditorCopyShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
}

export function isCanvasEditorUndoShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
}

export function isCanvasEditorDeleteShortcut(event: KeyboardEvent) {
  return event.key === "Delete" || event.key === "Backspace";
}

export function useCanvasEditorHistory<T>({ value, onChange, maxEntries = 40 }: { value: T; onChange: (value: T) => void; maxEntries?: number }) {
  const historyRef = useRef<T[]>([]);

  const recordHistory = (entry: T = value) => {
    historyRef.current = [...historyRef.current.slice(-(maxEntries - 1)), entry];
  };

  const updateWithHistory = (nextValue: T, record = true) => {
    if (record) {
      recordHistory(value);
    }

    onChange(nextValue);
  };

  const undo = () => {
    const previous = historyRef.current.at(-1);

    if (!previous) {
      return false;
    }

    historyRef.current = historyRef.current.slice(0, -1);
    onChange(previous);
    return true;
  };

  return { recordHistory, updateWithHistory, undo };
}

export function useCanvasEditorPointerDrag<T extends CanvasEditorPointerDragBase>() {
  const [dragState, setDragState] = useState<T>();

  const startPointerDrag = (event: PointerEvent<HTMLElement>, canvasRef: RefObject<HTMLElement | null>, createDragState: (base: CanvasEditorPointerDragBase) => T) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return false;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState(createDragState({ pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, canvasWidth: rect.width, canvasHeight: rect.height }));
    return true;
  };

  const readPointerDragDelta = (event: PointerEvent<HTMLElement>): CanvasEditorPointerDragDelta<T> | undefined => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return undefined;
    }

    return {
      dragState,
      deltaX: ((event.clientX - dragState.startClientX) / dragState.canvasWidth) * 100,
      deltaY: ((event.clientY - dragState.startClientY) / dragState.canvasHeight) * 100,
    };
  };

  const finishPointerDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const dragDelta = readPointerDragDelta(event);

    if (dragDelta) {
      setDragState(undefined);
    }

    return dragDelta;
  };

  return { dragState, setDragState, startPointerDrag, readPointerDragDelta, finishPointerDrag };
}

export function useCanvasEditorFloatingPanelDrag<T extends { x: number; y: number }>({ position, onPositionChange, relativeRef, minX, maxX, minY, maxY, clampToViewport = false, viewportMargin = 8 }: { position: T; onPositionChange: (position: T) => void; relativeRef?: RefObject<HTMLElement | null>; minX?: number; maxX?: number; minY?: number; maxY?: number; clampToViewport?: boolean; viewportMargin?: number }) {
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number; width?: number; height?: number; panelWidth?: number; panelHeight?: number } | undefined>(undefined);
  const clamp = (value: number, min: number | undefined, max: number | undefined) => Math.min(Math.max(value, min ?? value), max ?? value);

  const startPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (isCanvasEditorInteractiveTarget(event.target)) {
      return;
    }

    const bounds = relativeRef?.current?.getBoundingClientRect();
    const panelBounds = event.currentTarget.closest("[data-canvas-floating-panel='true']")?.getBoundingClientRect();

    if (relativeRef && (!bounds || bounds.width <= 0 || bounds.height <= 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: position.x, startY: position.y, width: bounds?.width, height: bounds?.height, panelWidth: panelBounds?.width, panelHeight: panelBounds?.height };
  };

  const movePanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    const deltaX = dragRef.current.width ? ((event.clientX - dragRef.current.startClientX) / dragRef.current.width) * 100 : event.clientX - dragRef.current.startClientX;
    const deltaY = dragRef.current.height ? ((event.clientY - dragRef.current.startClientY) / dragRef.current.height) * 100 : event.clientY - dragRef.current.startClientY;
    const viewportMaxX = clampToViewport && typeof window !== "undefined" ? window.innerWidth - (dragRef.current.panelWidth ?? 0) - viewportMargin : undefined;
    const viewportMaxY = clampToViewport && typeof window !== "undefined" ? window.innerHeight - (dragRef.current.panelHeight ?? 0) - viewportMargin : undefined;
    const nextMinX = clampToViewport ? viewportMargin : minX;
    const nextMinY = clampToViewport ? viewportMargin : minY;
    const nextMaxX = clampToViewport ? Math.max(viewportMargin, viewportMaxX ?? viewportMargin) : maxX;
    const nextMaxY = clampToViewport ? Math.max(viewportMargin, viewportMaxY ?? viewportMargin) : maxY;

    onPositionChange({ ...position, x: clamp(dragRef.current.startX + deltaX, nextMinX, nextMaxX), y: clamp(dragRef.current.startY + deltaY, nextMinY, nextMaxY) });
  };

  const stopPanelDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    dragRef.current = undefined;
  };

  return { startPanelDrag, movePanelDrag, stopPanelDrag };
}
