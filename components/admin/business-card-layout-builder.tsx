"use client";

import Image from "next/image";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { BusinessCardInfoBlockRenderer } from "@/components/business-card-info-block-renderer";
import { businessCardTemplateFieldIds, businessCardTemplateFontFamilies, businessCardTemplateIconArtwork, businessCardTemplateIconIds, businessCardTemplateTextWeights } from "@/lib/business-card-templates";
import { businessCardIconChromeStyle, businessCardInfoBlockIconTextGapPx, businessCardTrimWidthScale, displayBusinessCardFieldValue, editableBusinessCardFieldValue, fittedBusinessCardFontSizePx, fontFamilies, formatPercent, getBusinessCardTrimMetrics, resolveBusinessCardContactLayout, sampleBusinessCardFieldValues, type BusinessCardInfoBlock } from "@/lib/business-card-rendering";
import type { BusinessCardTemplateBox, BusinessCardTemplateFontFamily, BusinessCardTemplateIconElement, BusinessCardTemplateIconId, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateSideId, BusinessCardTemplateTextAlign, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId, BusinessCardTemplateTextWeight } from "@/lib/types";

type BusinessCardLayoutBuilderProps = {
  layout: BusinessCardTemplateLayout;
  orientation: "horizontal" | "vertical";
  managedBackgrounds: BusinessCardLayoutManagedBackground[];
  onChange: (layout: BusinessCardTemplateLayout) => void;
};

export type BusinessCardLayoutManagedBackground = {
  id: string;
  name: string;
  tags: string[];
  imageUrl: string;
  used: boolean;
  usageCount: number;
};

type BusinessCardTemplateBackground = BusinessCardTemplateLayout["sides"][BusinessCardTemplateSideId]["background"];
type BusinessCardTemplateLogoElement = BusinessCardTemplateLayout["sides"][BusinessCardTemplateSideId]["logo"];
type BoxKey = keyof BusinessCardTemplateBox;
type ResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type SelectedItem = { type: "field"; fieldId: BusinessCardTemplateTextFieldId } | { type: "logo" } | { type: "icon"; iconId: string } | { type: "line"; lineId: string } | { type: "info-block"; blockId: string };
type ControlsPosition = { x: number; y: number };

type DragState =
  | {
      type: "logo-move";
      pointerId: number;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "logo-resize";
      pointerId: number;
      corner: ResizeCorner;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "line-move";
      pointerId: number;
      lineId: string;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "line-resize";
      pointerId: number;
      lineId: string;
      corner: ResizeCorner;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "field-move";
      pointerId: number;
      fieldId: BusinessCardTemplateTextFieldId;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "field-resize";
      pointerId: number;
      fieldId: BusinessCardTemplateTextFieldId;
      corner: ResizeCorner;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "info-block-move";
      pointerId: number;
      blockId: string;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      startFields: Array<{ id: BusinessCardTemplateTextFieldId; box: BusinessCardTemplateBox }>;
      startIcons: Array<{ id: string; box: BusinessCardTemplateBox }>;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "icon-move";
      pointerId: number;
      iconId: string;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      type: "icon-resize";
      pointerId: number;
      iconId: string;
      corner: ResizeCorner;
      startClientX: number;
      startClientY: number;
      startBox: BusinessCardTemplateBox;
      canvasWidth: number;
      canvasHeight: number;
    };

type DragStartState =
  | { type: "logo-move"; startBox: BusinessCardTemplateBox }
  | { type: "logo-resize"; corner: ResizeCorner; startBox: BusinessCardTemplateBox }
  | { type: "field-move"; fieldId: BusinessCardTemplateTextFieldId; startBox: BusinessCardTemplateBox }
  | { type: "info-block-move"; block: BusinessCardInfoBlock }
  | { type: "field-resize"; fieldId: BusinessCardTemplateTextFieldId; corner: ResizeCorner; startBox: BusinessCardTemplateBox }
  | { type: "icon-move"; iconId: string; startBox: BusinessCardTemplateBox }
  | { type: "icon-resize"; iconId: string; corner: ResizeCorner; startBox: BusinessCardTemplateBox }
  | { type: "line-move"; lineId: string; startBox: BusinessCardTemplateBox }
  | { type: "line-resize"; lineId: string; corner: ResizeCorner; startBox: BusinessCardTemplateBox };

const sideLabels: Record<BusinessCardTemplateSideId, string> = {
  front: "앞면",
  back: "뒷면",
};

const fieldLabels: Record<BusinessCardTemplateTextFieldId, string> = {
  role: "직함",
  name: "이름",
  phone: "전화",
  mainPhone: "대표전화",
  fax: "FAX",
  email: "이메일",
  website: "웹도메인",
  address: "주소",
};

const fontLabels: Record<BusinessCardTemplateFontFamily, string> = {
  sans: "고딕",
  serif: "명조",
  rounded: "둥근",
  mono: "고정폭",
  display: "부드러운",
  handwriting: "손글씨",
};

const fontPreviewClasses: Record<BusinessCardTemplateFontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  rounded: "font-display",
  mono: "font-mono",
  display: "font-display",
  handwriting: "font-display italic",
};

const textWeightLabels: Record<BusinessCardTemplateTextWeight, string> = {
  regular: "보통",
  bold: "굵게",
};

const textAlignLabels: Record<BusinessCardTemplateTextAlign, string> = {
  left: "좌측",
  center: "중앙",
  right: "우측",
};

const iconLabels: Record<BusinessCardTemplateIconId, string> = {
  phone: "전화",
  email: "메일",
  location: "위치",
  fax: "팩스",
  building: "회사",
  web: "웹",
};

const sideIds: BusinessCardTemplateSideId[] = ["front", "back"];
const defaultIconColor = "#075dcb";
const defaultLineColor = "#111827";
const gridStep = 2.5;

const resizeCorners: Array<{ corner: ResizeCorner; className: string; cursorClassName: string }> = [
  { corner: "top-left", className: "left-0 top-0", cursorClassName: "cursor-nwse-resize" },
  { corner: "top-right", className: "right-0 top-0", cursorClassName: "cursor-nesw-resize" },
  { corner: "bottom-left", className: "bottom-0 left-0", cursorClassName: "cursor-nesw-resize" },
  { corner: "bottom-right", className: "bottom-0 right-0", cursorClassName: "cursor-nwse-resize" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function snapPercent(value: number) {
  return roundPercent(Math.round(value / gridStep) * gridStep);
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ").replace(/\r/g, "");
}

function cssUrl(value: string) {
  return `url("${escapeCssString(value.trim())}")`;
}

function boxStyle(box: BusinessCardTemplateBox): CSSProperties {
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

function updateBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  if (!Number.isFinite(value)) {
    return box;
  }

  if (key === "x") {
    return { ...box, x: roundPercent(clamp(value, 0, 100 - box.width)) };
  }

  if (key === "y") {
    return { ...box, y: roundPercent(clamp(value, 0, 100 - box.height)) };
  }

  if (key === "width") {
    return { ...box, width: roundPercent(clamp(value, 1, 100 - box.x)) };
  }

  return { ...box, height: roundPercent(clamp(value, 1, 100 - box.y)) };
}

function updateLineBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  if (!Number.isFinite(value)) {
    return box;
  }

  if (key === "width") {
    return { ...box, width: roundPercent(clamp(value, 0.25, 100 - box.x)) };
  }

  if (key === "height") {
    return { ...box, height: roundPercent(clamp(value, 0.25, 100 - box.y)) };
  }

  return updateBoxValue(box, key, value);
}

function moveBox(box: BusinessCardTemplateBox, deltaX: number, deltaY: number): BusinessCardTemplateBox {
  return {
    ...box,
    x: roundPercent(clamp(box.x + deltaX, 0, 100 - box.width)),
    y: roundPercent(clamp(box.y + deltaY, 0, 100 - box.height)),
  };
}

function snapBoxTopLeft(box: BusinessCardTemplateBox): BusinessCardTemplateBox {
  return {
    ...box,
    x: roundPercent(clamp(snapPercent(box.x), 0, 100 - box.width)),
    y: roundPercent(clamp(snapPercent(box.y), 0, 100 - box.height)),
  };
}

function resizeBox(box: BusinessCardTemplateBox, corner: ResizeCorner, deltaX: number, deltaY: number): BusinessCardTemplateBox {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  let nextX = box.x;
  let nextY = box.y;
  let nextWidth = box.width;
  let nextHeight = box.height;

  if (corner === "top-left" || corner === "bottom-left") {
    nextX = clamp(box.x + deltaX, 0, right - 1);
    nextWidth = right - nextX;
  } else {
    nextWidth = clamp(box.width + deltaX, 1, 100 - box.x);
  }

  if (corner === "top-left" || corner === "top-right") {
    nextY = clamp(box.y + deltaY, 0, bottom - 1);
    nextHeight = bottom - nextY;
  } else {
    nextHeight = clamp(box.height + deltaY, 1, 100 - box.y);
  }

  return {
    x: roundPercent(nextX),
    y: roundPercent(nextY),
    width: roundPercent(nextWidth),
    height: roundPercent(nextHeight),
  };
}

function sampleFieldValue(fieldId: BusinessCardTemplateTextFieldId) {
  return sampleBusinessCardFieldValues[fieldId];
}

function editableFieldValue(field: BusinessCardTemplateTextElement) {
  const value = field.customValue ?? sampleFieldValue(field.id);

  return editableBusinessCardFieldValue(field.id, value);
}

function displayFieldValue(field: BusinessCardTemplateTextElement) {
  const value = field.customValue ?? sampleFieldValue(field.id);

  return displayBusinessCardFieldValue(field.id, value);
}

function readBackgroundImageUrl(background: BusinessCardTemplateBackground) {
  return background.enabled && background.type === "image" ? background.imageUrl.trim() : "";
}

function readBackgroundColor(background: BusinessCardTemplateBackground) {
  if (!background.enabled) {
    return "";
  }

  return background.type === "color" ? background.color : background.color ?? "";
}

function normalizeHexColorInput(value: string) {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : undefined;
}

function getField(layout: BusinessCardTemplateLayout, sideId: BusinessCardTemplateSideId, fieldId: BusinessCardTemplateTextFieldId) {
  const matchingField = layout.sides[sideId].fields.find((field) => field.id === fieldId);

  if (matchingField) {
    return matchingField;
  }

  return { id: fieldId, visible: false, box: { x: 0, y: 0, width: 1, height: 1 }, fontFamily: "sans", fontSize: 18, color: "#111827", fontWeight: "bold", italic: false, align: "left" } satisfies BusinessCardTemplateTextElement;
}

function iconMarkup(iconId: BusinessCardTemplateIconId, className = "block h-full w-full") {
  const icon = businessCardTemplateIconArtwork[iconId];

  return (
    <svg className={className} viewBox={icon.viewBox} aria-hidden="true">
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}

export function BusinessCardLayoutBuilder({ layout, orientation, managedBackgrounds, onChange }: BusinessCardLayoutBuilderProps) {
  const [activeSide, setActiveSide] = useState<BusinessCardTemplateSideId>("front");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | undefined>({ type: "field", fieldId: "name" });
  const [controlsPositions, setControlsPositions] = useState<Record<string, ControlsPosition>>({});
  const [dragState, setDragState] = useState<DragState>();
  const [showGrid, setShowGrid] = useState(true);
  const historyRef = useRef<BusinessCardTemplateLayout[]>([]);
  const layoutRef = useRef(layout);
  const canvasRef = useRef<HTMLDivElement>(null);
  const side = layout.sides[activeSide];
  const selectedFieldId = selectedItem?.type === "field" ? selectedItem.fieldId : "name";
  const selectedField = getField(layout, activeSide, selectedFieldId);
  const selectedIcon = selectedItem?.type === "icon" ? side.icons.find((icon) => icon.id === selectedItem.iconId) : undefined;
  const selectedLine = selectedItem?.type === "line" ? side.lines.find((line) => line.id === selectedItem.lineId) : undefined;
  const canvasAspect = `${layout.canvas.trim.widthMm} / ${layout.canvas.trim.heightMm}`;
  const { cssPixelScale } = getBusinessCardTrimMetrics(layout.canvas.trim);
  const trimWidthScale = businessCardTrimWidthScale(layout.canvas.trim);
  const orientationLabel = orientation === "vertical" ? "세로형" : "가로형";
  const activeBackgroundImageUrl = readBackgroundImageUrl(side.background);
  const activeBackgroundColor = readBackgroundColor(side.background);
  const hasActiveBackgroundImage = activeBackgroundImageUrl.length > 0;
  const activeManagedBackground = hasActiveBackgroundImage ? managedBackgrounds.find((background) => background.imageUrl === activeBackgroundImageUrl) : undefined;
  const hasUnregisteredBackgroundImage = hasActiveBackgroundImage && !activeManagedBackground;
  const selectedControlsKey = selectedItem ? `${activeSide}:${selectedItem.type}:${selectedItem.type === "field" ? selectedItem.fieldId : selectedItem.type === "icon" ? selectedItem.iconId : selectedItem.type === "line" ? selectedItem.lineId : selectedItem.type === "info-block" ? selectedItem.blockId : "logo"}` : undefined;
  const selectedControlsPosition = selectedControlsKey ? controlsPositions[selectedControlsKey] ?? { x: 12, y: 12 } : { x: 12, y: 12 };
  const [canvasScale, setCanvasScale] = useState(1);
  const renderPixelScale = cssPixelScale * canvasScale;
  const contactLayout = resolveBusinessCardContactLayout(side.fields, side.icons, (field) => field.customValue ?? sampleFieldValue(field.id));
  const selectedInfoBlock = selectedItem?.type === "info-block" ? contactLayout.blocks.find((block) => block.id === selectedItem.blockId) : undefined;

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const updateScale = () => {
      const rect = canvas.getBoundingClientRect();
      setCanvasScale(rect.width > 0 ? rect.width / (layout.canvas.trim.widthMm * (96 / 25.4)) : 1);
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [layout.canvas.trim.widthMm]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        const previousLayout = historyRef.current.pop();

        if (previousLayout) {
          event.preventDefault();
          onChange(previousLayout);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  const updateLayout = (nextLayout: BusinessCardTemplateLayout) => {
    historyRef.current = [...historyRef.current.slice(-39), layoutRef.current];
    onChange(nextLayout);
  };

  const updateActiveSide = (nextSide: typeof side) => {
    updateLayout({ ...layout, sides: { ...layout.sides, [activeSide]: nextSide } });
  };

  const updateLogoBox = (nextBox: BusinessCardTemplateBox) => {
    updateActiveSide({ ...side, logo: { ...side.logo, box: nextBox } });
  };

  const updateField = (fieldId: BusinessCardTemplateTextFieldId, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => {
    updateActiveSide({ ...side, fields: side.fields.map((field) => (field.id === fieldId ? updater(field) : field)) });
  };

  const updateIcon = (iconId: string, updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => {
    updateActiveSide({ ...side, icons: side.icons.map((icon) => (icon.id === iconId ? updater(icon) : icon)) });
  };

  const updateInfoBlock = (block: BusinessCardInfoBlock, updater: (box: BusinessCardTemplateBox) => BusinessCardTemplateBox) => {
    const nextBox = updater(block.box);
    const deltaX = nextBox.x - block.box.x;
    const deltaY = nextBox.y - block.box.y;
    const deltaWidth = nextBox.width - block.box.width;
    const deltaHeight = nextBox.height - block.box.height;
    const fieldIds = new Set(block.rows.flatMap((row) => row.items.map((item) => item.field.id)));
    const iconId = block.icon?.id;
    const moveChildBox = (box: BusinessCardTemplateBox): BusinessCardTemplateBox => ({
      ...box,
      x: roundPercent(clamp(box.x + deltaX, 0, 100 - box.width)),
      y: roundPercent(clamp(box.y + deltaY, 0, 100 - box.height)),
    });
    const resizeFieldBox = (box: BusinessCardTemplateBox): BusinessCardTemplateBox => ({
      x: roundPercent(clamp(box.x + deltaX, 0, 99)),
      y: roundPercent(clamp(box.y + deltaY, 0, 99)),
      width: roundPercent(clamp(box.width + deltaWidth, 1, 100 - clamp(box.x + deltaX, 0, 99))),
      height: roundPercent(clamp(box.height + deltaHeight, 1, 100 - clamp(box.y + deltaY, 0, 99))),
    });

    updateActiveSide({
      ...side,
      fields: side.fields.map((field) => (fieldIds.has(field.id) ? { ...field, box: resizeFieldBox(field.box) } : field)),
      icons: side.icons.map((icon) => (icon.id === iconId ? { ...icon, box: moveChildBox(icon.box) } : icon)),
    });
  };

  const updateInfoBlockFields = (block: BusinessCardInfoBlock, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => {
    const fieldIds = new Set(block.rows.flatMap((row) => row.items.map((item) => item.field.id)));
    updateActiveSide({ ...side, fields: side.fields.map((field) => (fieldIds.has(field.id) ? updater(field) : field)) });
  };

  const updateInfoBlockField = (fieldId: BusinessCardTemplateTextFieldId, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => {
    updateField(fieldId, updater);
  };

  const updateInfoBlockIcon = (block: BusinessCardInfoBlock, updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => {
    if (!block.icon) {
      return;
    }

    updateIcon(block.icon.id, updater);
  };

  const updateLine = (lineId: string, updater: (line: BusinessCardTemplateLineElement) => BusinessCardTemplateLineElement) => {
    updateActiveSide({ ...side, lines: side.lines.map((line) => (line.id === lineId ? updater(line) : line)) });
  };

  const updateFieldBox = (fieldId: BusinessCardTemplateTextFieldId, key: BoxKey, value: number) => {
    updateField(fieldId, (field) => ({ ...field, box: updateBoxValue(field.box, key, value) }));
  };

  const updateFieldText = (field: BusinessCardTemplateTextElement) => {
    const nextValue = window.prompt(field.id === "fax" ? "팩스번호를 입력해 주세요. FAX 글자는 자동으로 붙어요." : `${fieldLabels[field.id]} 텍스트를 입력해 주세요.`, editableFieldValue(field));

    if (nextValue === null) {
      return;
    }

    const trimmedValue = nextValue.trim();

    updateField(field.id, (current) => {
      if (current.id === "fax") {
        return trimmedValue ? { ...current, customValue: trimmedValue } : { ...current, customValue: undefined };
      }

      return trimmedValue ? { ...current, customValue: trimmedValue } : { ...current, customValue: undefined };
    });
  };

  const updateSelectedControlsPosition = (position: ControlsPosition) => {
    if (!selectedControlsKey) {
      return;
    }

    setControlsPositions((current) => ({ ...current, [selectedControlsKey]: position }));
  };

  const startCanvasDrag = (event: PointerEvent<HTMLElement>, nextDragState: DragStartState) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const dragBase = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, canvasWidth: rect.width, canvasHeight: rect.height };

    if (nextDragState.type === "logo-resize") {
      setDragState({ ...dragBase, type: "logo-resize", corner: nextDragState.corner, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "field-move") {
      setDragState({ ...dragBase, type: "field-move", fieldId: nextDragState.fieldId, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "info-block-move") {
      setDragState({ ...dragBase, type: "info-block-move", blockId: nextDragState.block.id, startBox: nextDragState.block.box, startFields: nextDragState.block.rows.flatMap((row) => row.items.map((item) => ({ id: item.field.id, box: item.field.box }))), startIcons: nextDragState.block.icon ? [{ id: nextDragState.block.icon.id, box: nextDragState.block.icon.box }] : [] });
      return;
    }

    if (nextDragState.type === "field-resize") {
      setDragState({ ...dragBase, type: "field-resize", fieldId: nextDragState.fieldId, corner: nextDragState.corner, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "icon-move") {
      setDragState({ ...dragBase, type: "icon-move", iconId: nextDragState.iconId, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "icon-resize") {
      setDragState({ ...dragBase, type: "icon-resize", iconId: nextDragState.iconId, corner: nextDragState.corner, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "line-move") {
      setDragState({ ...dragBase, type: "line-move", lineId: nextDragState.lineId, startBox: nextDragState.startBox });
      return;
    }

    if (nextDragState.type === "line-resize") {
      setDragState({ ...dragBase, type: "line-resize", lineId: nextDragState.lineId, corner: nextDragState.corner, startBox: nextDragState.startBox });
      return;
    }

    setDragState({ ...dragBase, type: "logo-move", startBox: nextDragState.startBox });
  };

  const handleLogoMovePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!side.logo.visible) {
      return;
    }

    setSelectedItem({ type: "logo" });
    startCanvasDrag(event, { type: "logo-move", startBox: side.logo.box });
  };

  const handleLogoResizePointerDown = (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => {
    if (!side.logo.visible) {
      return;
    }

    event.stopPropagation();
    startCanvasDrag(event, { type: "logo-resize", corner, startBox: side.logo.box });
  };

  const handleTextFieldPointerDown = (event: PointerEvent<HTMLDivElement>, field: BusinessCardTemplateTextElement) => {
    setSelectedItem({ type: "field", fieldId: field.id });

    if (!field.visible) {
      return;
    }

    startCanvasDrag(event, { type: "field-move", fieldId: field.id, startBox: field.box });
  };

  const handleInfoBlockPointerDown = (event: PointerEvent<HTMLDivElement>, block: BusinessCardInfoBlock) => {
    setSelectedItem({ type: "info-block", blockId: block.id });
    startCanvasDrag(event, { type: "info-block-move", block });
  };

  const handleTextFieldResizePointerDown = (event: PointerEvent<HTMLSpanElement>, field: BusinessCardTemplateTextElement, corner: ResizeCorner) => {
    setSelectedItem({ type: "field", fieldId: field.id });

    if (!field.visible) {
      return;
    }

    event.stopPropagation();
    startCanvasDrag(event, { type: "field-resize", fieldId: field.id, corner, startBox: field.box });
  };

  const handleIconPointerDown = (event: PointerEvent<HTMLDivElement>, icon: BusinessCardTemplateIconElement) => {
    setSelectedItem({ type: "icon", iconId: icon.id });

    if (icon.visible) {
      startCanvasDrag(event, { type: "icon-move", iconId: icon.id, startBox: icon.box });
    }
  };

  const handleIconResizePointerDown = (event: PointerEvent<HTMLSpanElement>, icon: BusinessCardTemplateIconElement, corner: ResizeCorner) => {
    setSelectedItem({ type: "icon", iconId: icon.id });

    if (!icon.visible) {
      return;
    }

    event.stopPropagation();
    startCanvasDrag(event, { type: "icon-resize", iconId: icon.id, corner, startBox: icon.box });
  };

  const handleLinePointerDown = (event: PointerEvent<HTMLDivElement>, line: BusinessCardTemplateLineElement) => {
    setSelectedItem({ type: "line", lineId: line.id });

    if (line.visible) {
      startCanvasDrag(event, { type: "line-move", lineId: line.id, startBox: line.box });
    }
  };

  const handleLineResizePointerDown = (event: PointerEvent<HTMLSpanElement>, line: BusinessCardTemplateLineElement, corner: ResizeCorner) => {
    setSelectedItem({ type: "line", lineId: line.id });

    if (!line.visible) {
      return;
    }

    event.stopPropagation();
    startCanvasDrag(event, { type: "line-resize", lineId: line.id, corner, startBox: line.box });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = ((event.clientX - dragState.startClientX) / dragState.canvasWidth) * 100;
    const deltaY = ((event.clientY - dragState.startClientY) / dragState.canvasHeight) * 100;

    if (dragState.type === "logo-resize") {
      updateLogoBox(resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY));
      return;
    }

    if (dragState.type === "field-move") {
      updateField(dragState.fieldId, (field) => (field.visible ? { ...field, box: moveBox(dragState.startBox, deltaX, deltaY) } : field));
      return;
    }

    if (dragState.type === "info-block-move") {
      const fieldBoxes = new Map(dragState.startFields.map((item) => [item.id, moveBox(item.box, deltaX, deltaY)]));
      const iconBoxes = new Map(dragState.startIcons.map((item) => [item.id, moveBox(item.box, deltaX, deltaY)]));
      updateActiveSide({ ...side, fields: side.fields.map((field) => fieldBoxes.has(field.id) ? { ...field, box: fieldBoxes.get(field.id) ?? field.box } : field), icons: side.icons.map((icon) => iconBoxes.has(icon.id) ? { ...icon, box: iconBoxes.get(icon.id) ?? icon.box } : icon) });
      return;
    }

    if (dragState.type === "field-resize") {
      updateField(dragState.fieldId, (field) => (field.visible ? { ...field, box: resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY) } : field));
      return;
    }

    if (dragState.type === "icon-move") {
      updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: moveBox(dragState.startBox, deltaX, deltaY) } : icon));
      return;
    }

    if (dragState.type === "icon-resize") {
      updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY) } : icon));
      return;
    }

    if (dragState.type === "line-move") {
      updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: moveBox(dragState.startBox, deltaX, deltaY) } : line));
      return;
    }

    if (dragState.type === "line-resize") {
      updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY) } : line));
      return;
    }

    updateLogoBox(moveBox(dragState.startBox, deltaX, deltaY));
  };

  const stopPointerDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState?.pointerId === event.pointerId) {
      const deltaX = ((event.clientX - dragState.startClientX) / dragState.canvasWidth) * 100;
      const deltaY = ((event.clientY - dragState.startClientY) / dragState.canvasHeight) * 100;

      if (showGrid && (dragState.type === "field-move" || dragState.type === "icon-move" || dragState.type === "line-move" || dragState.type === "logo-move" || dragState.type === "info-block-move")) {
        const nextBox = snapBoxTopLeft(moveBox(dragState.startBox, deltaX, deltaY));

        if (dragState.type === "info-block-move") {
          const snappedDeltaX = nextBox.x - dragState.startBox.x;
          const snappedDeltaY = nextBox.y - dragState.startBox.y;
          const fieldBoxes = new Map(dragState.startFields.map((item) => [item.id, moveBox(item.box, snappedDeltaX, snappedDeltaY)]));
          const iconBoxes = new Map(dragState.startIcons.map((item) => [item.id, moveBox(item.box, snappedDeltaX, snappedDeltaY)]));
          updateActiveSide({ ...side, fields: side.fields.map((field) => fieldBoxes.has(field.id) ? { ...field, box: fieldBoxes.get(field.id) ?? field.box } : field), icons: side.icons.map((icon) => iconBoxes.has(icon.id) ? { ...icon, box: iconBoxes.get(icon.id) ?? icon.box } : icon) });
        }

        if (dragState.type === "field-move") {
          updateField(dragState.fieldId, (field) => (field.visible ? { ...field, box: nextBox } : field));
        }

        if (dragState.type === "icon-move") {
          updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: nextBox } : icon));
        }

        if (dragState.type === "logo-move") {
          updateLogoBox(nextBox);
        }

        if (dragState.type === "line-move") {
          updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: nextBox } : line));
        }
      }

      setDragState(undefined);
    }
  };

  const applyManagedBackground = (backgroundId: string) => {
    const background = managedBackgrounds.find((item) => item.id === backgroundId);

    if (!background) {
      return;
    }

    updateActiveSide({ ...side, background: activeBackgroundColor.length > 0 ? { enabled: true, type: "image", imageUrl: background.imageUrl, color: activeBackgroundColor } : { enabled: true, type: "image", imageUrl: background.imageUrl } });
  };

  const removeActiveBackground = () => {
    updateActiveSide({ ...side, background: { enabled: false } });
  };

  const updateActiveBackgroundColor = (color: string) => {
    if (side.background.enabled && side.background.type === "image" && hasActiveBackgroundImage) {
      updateActiveSide({ ...side, background: { enabled: true, type: "image", imageUrl: side.background.imageUrl, color } });
      return;
    }

    updateActiveSide({ ...side, background: { enabled: true, type: "color", color } });
  };

  const toggleIcon = (iconId: BusinessCardTemplateIconId) => {
    const matchingIcons = side.icons.filter((icon) => icon.icon === iconId);
    const visibleIcon = matchingIcons.find((icon) => icon.visible);

    if (visibleIcon) {
      updateActiveSide({ ...side, icons: side.icons.map((icon) => (icon.icon === iconId ? { ...icon, visible: false } : icon)) });

      if (selectedItem?.type === "icon" && matchingIcons.some((icon) => icon.id === selectedItem.iconId)) {
        setSelectedItem({ type: "field", fieldId: "name" });
      }

      return;
    }

    const hiddenIcon = matchingIcons[0];

    if (hiddenIcon) {
      updateIcon(hiddenIcon.id, (icon) => ({ ...icon, visible: true }));
      setSelectedItem({ type: "icon", iconId: hiddenIcon.id });
      return;
    }

    const usedIconIds = new Set(side.icons.map((icon) => icon.id));
    let iconSequence = side.icons.length + 1;
    let nextIconId = `icon-${activeSide}-${iconSequence}`;

    while (usedIconIds.has(nextIconId)) {
      iconSequence += 1;
      nextIconId = `icon-${activeSide}-${iconSequence}`;
    }

    const nextIcon: BusinessCardTemplateIconElement = {
      id: nextIconId,
      icon: iconId,
      visible: true,
      box: { x: 46, y: 46, width: 7, height: 7 },
      color: defaultIconColor,
    };

    updateActiveSide({ ...side, icons: [...side.icons, nextIcon] });
    setSelectedItem({ type: "icon", iconId: nextIcon.id });
  };

  const addLine = (orientation: BusinessCardTemplateLineElement["orientation"]) => {
    const usedLineIds = new Set(side.lines.map((line) => line.id));
    let lineSequence = side.lines.length + 1;
    let nextLineId = `line-${activeSide}-${lineSequence}`;

    while (usedLineIds.has(nextLineId)) {
      lineSequence += 1;
      nextLineId = `line-${activeSide}-${lineSequence}`;
    }

    const nextLine: BusinessCardTemplateLineElement = {
      id: nextLineId,
      orientation,
      visible: true,
      box: orientation === "horizontal" ? { x: 20, y: 50, width: 60, height: 1 } : { x: 50, y: 20, width: 1, height: 60 },
      color: defaultLineColor,
    };

    updateActiveSide({ ...side, lines: [...side.lines, nextLine] });
    setSelectedItem({ type: "line", lineId: nextLine.id });
  };

  return (
    <section className="rounded-lg border border-line bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 shadow-card">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black text-primary-strong">양면 레이아웃 빌더</p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">안전 영역을 참고해 배치해요</h3>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">실선 안전선은 인쇄 여백을 확인하는 참고선이에요. 격자를 켜면 드래그를 놓는 순간 가까운 점에 맞춰요.</p>
        </div>
        <div className="flex rounded-md bg-surface p-1 shadow-soft">
          {sideIds.map((sideId) => (
            <button key={sideId} className={`rounded-sm px-4 py-2 text-xs font-black transition ${activeSide === sideId ? "bg-primary text-white shadow-soft" : "text-primary-strong hover:bg-surface-blue"}`} type="button" onClick={() => {
              setActiveSide(sideId);
              setSelectedItem(layout.sides[sideId].logo.visible ? { type: "logo" } : undefined);
            }}>
              {sideLabels[sideId]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{sideLabels[activeSide]} · {orientationLabel}</span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs font-black text-soft">점선: 편집선 · 실선: 안전선</span>
              <CheckboxPill label="격자 보기" checked={showGrid} onChange={setShowGrid} />
            </div>
          </div>
          <div className="grid place-items-center rounded-lg bg-[radial-gradient(circle_at_20%_20%,var(--color-primary-soft)_0%,transparent_28%),linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 sm:p-6 lg:p-8">
            <div ref={canvasRef} className={`relative w-full overflow-visible rounded-md border border-line bg-surface shadow-floating ${orientation === "vertical" ? "max-w-md" : "max-w-4xl"}`} style={{ aspectRatio: canvasAspect, backgroundColor: activeBackgroundColor || undefined }} onPointerDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedItem(undefined);
              }
            }}>
              {hasActiveBackgroundImage ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: cssUrl(activeBackgroundImageUrl) }} /> : null}
              {showGrid ? <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(to right, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to right, rgba(7, 93, 203, 0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.34) 1px, transparent 1px)", backgroundSize: "2.5% 2.5%, 2.5% 2.5%, 10% 10%, 10% 10%" }} aria-hidden="true" /> : null}
              <GuideBox box={layout.canvas.edit} label="EDIT" tone="edit" />
              <GuideBox box={layout.canvas.safe} label="SAFE" tone="safe" />
              {side.lines.map((line) => (line.visible ? <LinePreview key={line.id} line={line} selected={selectedItem?.type === "line" && selectedItem.lineId === line.id} onPointerDown={(event) => handleLinePointerDown(event, line)} onResizePointerDown={(event, corner) => handleLineResizePointerDown(event, line, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null))}
              {contactLayout.blocks.map((block) => <BusinessCardInfoBlockRenderer key={block.id} block={block} cssPixelScale={renderPixelScale} gapScale={canvasScale} trimWidthScale={trimWidthScale} className="pointer-events-none absolute z-10 overflow-visible" />)}
              {contactLayout.fields.map((field) => (field.visible ? <TextFieldPreview key={field.id} field={field} selected={selectedItem?.type === "field" && selectedItem.fieldId === field.id} renderPixelScale={renderPixelScale} trimWidthScale={trimWidthScale} onDoubleClick={() => updateFieldText(field)} onPointerDown={(event) => handleTextFieldPointerDown(event, field)} onResizePointerDown={(event, corner) => handleTextFieldResizePointerDown(event, field, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null))}
              {contactLayout.icons.map((icon) => (icon.visible ? <IconPreview key={icon.id} icon={icon} selected={selectedItem?.type === "icon" && selectedItem.iconId === icon.id} cssPixelScale={renderPixelScale} onPointerDown={(event) => handleIconPointerDown(event, icon)} onResizePointerDown={(event, corner) => handleIconResizePointerDown(event, icon, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null))}
              {contactLayout.blocks.map((block) => <InfoBlockMovePreview key={block.id} block={block} selected={selectedItem?.type === "info-block" && selectedItem.blockId === block.id} onPointerDown={(event) => handleInfoBlockPointerDown(event, block)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} />)}
              {side.logo.visible ? (
                <button className={`absolute touch-none overflow-hidden rounded-sm border bg-transparent transition ${selectedItem?.type === "logo" ? "border-primary shadow-soft ring-2 ring-primary-soft" : "border-transparent hover:border-primary-soft/60"} cursor-grab active:cursor-grabbing`} type="button" aria-label="Printy 로고" style={boxStyle(side.logo.box)} onPointerDown={handleLogoMovePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag}>
                  <span className="absolute" style={{ inset: `${100 / layout.canvas.trim.widthMm}%` }}>
                    <Image className="object-contain" src="/printy_logo.svg" alt="Printy" fill sizes="220px" draggable={false} />
                  </span>
                  {selectedItem?.type === "logo"
                    ? resizeCorners.map((item) => (
                        <span key={item.corner} className={`absolute h-4 w-4 rounded-sm border-2 border-primary bg-surface shadow-soft ring-2 ring-primary-soft transition hover:scale-110 ${item.className} ${item.cursorClassName}`} aria-hidden="true" onPointerDown={(event) => handleLogoResizePointerDown(event, item.corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} />
                      ))
                    : null}
                </button>
              ) : null}
              {selectedItem && (selectedItem.type !== "logo" || side.logo.visible) ? <QuickControls selectedItem={selectedItem} position={selectedControlsPosition} field={selectedItem.type === "field" ? selectedField : undefined} icon={selectedIcon} line={selectedLine} logo={selectedItem.type === "logo" ? side.logo : undefined} infoBlock={selectedInfoBlock} onPositionChange={updateSelectedControlsPosition} onFieldChange={(updater) => updateField(selectedFieldId, updater)} onIconChange={(updater) => selectedIcon ? updateIcon(selectedIcon.id, updater) : undefined} onLineChange={(updater) => selectedLine ? updateLine(selectedLine.id, updater) : undefined} onLogoChange={(updater) => updateActiveSide({ ...side, logo: updater(side.logo) })} onInfoBlockChange={(updater) => selectedInfoBlock ? updateInfoBlock(selectedInfoBlock, updater) : undefined} onInfoBlockFieldsChange={(updater) => selectedInfoBlock ? updateInfoBlockFields(selectedInfoBlock, updater) : undefined} onInfoBlockFieldChange={updateInfoBlockField} onInfoBlockIconChange={(updater) => selectedInfoBlock ? updateInfoBlockIcon(selectedInfoBlock, updater) : undefined} /> : null}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="mb-4">
              <p className="text-xs font-black text-primary-strong">텍스트 필드</p>
                <p className="mt-1 text-xs font-bold text-muted">표시 여부만 선택하고, 세부 값은 편집 화면의 텍스트 설정창에서 조정해요.</p>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {contactLayout.blocks.map((block) => (
                <button key={block.id} className={`rounded-md px-3 py-2 text-xs font-black transition ${selectedItem?.type === "info-block" && selectedItem.blockId === block.id ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" onClick={() => setSelectedItem({ type: "info-block", blockId: block.id })}>
                  {infoBlockLabels[block.id] ?? "정보 영역"}
                </button>
              ))}
              {businessCardTemplateFieldIds.filter((fieldId) => !["phone", "mainPhone", "fax", "email", "website", "address"].includes(fieldId)).map((fieldId) => {
                const field = getField(layout, activeSide, fieldId);

                return (
                <button key={fieldId} className={`rounded-md px-3 py-2 text-xs font-black transition ${field.visible ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" aria-pressed={field.visible} onClick={() => {
                  updateField(fieldId, (current) => ({ ...current, visible: !current.visible }));

                  if (!field.visible) {
                    setSelectedItem({ type: "field", fieldId });
                  } else if (selectedItem?.type === "field" && selectedItem.fieldId === fieldId) {
                    setSelectedItem(undefined);
                  }
                }}>
                  {fieldLabels[fieldId]}
                </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-primary-strong">로고 박스</p>
                <p className="mt-1 text-xs font-bold text-muted">로고 표시 여부만 고르고, 위치와 크기는 편집 화면의 로고 설정창에서 조정해요.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {side.logo.visible ? <button className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5" type="button" onClick={() => setSelectedItem({ type: "logo" })}>편집</button> : null}
                <CheckboxPill label="표시" checked={side.logo.visible} onChange={(visible) => {
                  updateActiveSide({ ...side, logo: { ...side.logo, visible } });

                  if (visible) {
                    setSelectedItem({ type: "logo" });
                  } else if (selectedItem?.type === "logo") {
                    setSelectedItem({ type: "field", fieldId: "name" });
                  }
                }} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="mb-4">
              <p className="text-xs font-black text-primary-strong">기본 아이콘</p>
              <p className="mt-1 text-xs font-bold text-muted">안전한 내장 SVG만 배치해요. 추가한 아이콘은 선택 후 색과 위치를 바꿀 수 있어요.</p>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {businessCardTemplateIconIds.map((iconId) => (
                <button key={iconId} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-black shadow-soft transition hover:-translate-y-0.5 ${side.icons.some((icon) => icon.icon === iconId && icon.visible) ? "bg-primary text-white" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" onClick={() => toggleIcon(iconId)} aria-pressed={side.icons.some((icon) => icon.icon === iconId && icon.visible)}>
                  <span className="h-4 w-4">{iconMarkup(iconId)}</span>
                  {iconLabels[iconId]}
                </button>
              ))}
            </div>
            <p className="rounded-md bg-surface-blue px-4 py-3 text-xs font-bold text-muted">아이콘을 누르면 편집 화면에 표시되고, 다시 누르면 숨겨져요. 세부 값은 편집 화면의 아이콘 설정창에서 조정해요.</p>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="mb-4">
              <p className="text-xs font-black text-primary-strong">라인</p>
              <p className="mt-1 text-xs font-bold text-muted">가로/세로 라인을 추가하고, 세부 값은 편집 화면의 라인 설정창에서 조정해요.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5" type="button" onClick={() => addLine("horizontal")}>가로 라인 추가</button>
              <button className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5" type="button" onClick={() => addLine("vertical")}>세로 라인 추가</button>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-primary-strong">등록 배경</p>
                <p className="mt-1 text-xs font-bold leading-5 text-muted">공통 설정에 등록한 배경만 선택해요. 색상은 인쇄 누락 대비용으로 함께 저장돼요.</p>
              </div>
              {side.background.enabled ? <span className="rounded-md bg-primary px-3 py-2 text-xs font-black text-white shadow-soft">사용 중</span> : <span className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong">미사용</span>}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_220px]">
              <label className="block rounded-md border border-line bg-surface-blue p-3">
                <span className="mb-2 block text-xs font-extrabold text-primary-strong">배경 선택</span>
                <select className="w-full rounded-md border border-line bg-surface px-4 py-3 text-sm font-bold text-ink outline-none transition disabled:cursor-not-allowed disabled:text-soft focus:border-primary focus:shadow-soft" value={activeManagedBackground?.id ?? (hasUnregisteredBackgroundImage ? "__legacy" : "")} disabled={managedBackgrounds.length === 0} onChange={(event) => applyManagedBackground(event.target.value)}>
                  <option value="">등록 배경 선택</option>
                  {hasUnregisteredBackgroundImage ? <option value="__legacy" disabled>기존 URL 배경</option> : null}
                  {managedBackgrounds.map((background) => (
                    <option key={background.id} value={background.id}>{background.name}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs font-bold leading-5 text-muted">새 배경 업로드는 왼쪽 메뉴의 공통 설정에서만 진행해요.</span>
              </label>
              <div className="block rounded-md border border-line bg-surface-blue p-3">
                <ColorInput label="배경 색상" value={activeBackgroundColor || "#ffffff"} onChange={updateActiveBackgroundColor} />
                <span className="mt-2 block text-xs font-bold leading-5 text-muted">이미지가 있으면 인쇄 누락 대비용 배경색으로 저장해요.</span>
              </div>
            </div>
            {hasUnregisteredBackgroundImage ? <p className="mt-3 rounded-md bg-surface-blue px-4 py-3 text-xs font-bold leading-5 text-muted">이 템플릿은 기존 URL 배경을 사용 중이에요. 렌더링은 유지되고, 등록 배경을 선택하면 새 관리 흐름으로 전환돼요.</p> : null}
            {activeManagedBackground ? <div className="mt-3 flex flex-wrap gap-2">{activeManagedBackground.tags.map((tag) => <span key={tag} className="rounded-sm bg-primary-soft px-2 py-1 text-xs font-black text-primary-strong">#{tag}</span>)}</div> : null}
            {side.background.enabled ? (
              <div className="mt-3 flex justify-end">
                <button className="rounded-sm bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong transition hover:bg-primary-soft" type="button" onClick={removeActiveBackground}>
                  배경 제거
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}

function GuideBox({ box, label, tone }: { box: BusinessCardTemplateBox; label: string; tone: "edit" | "safe" }) {
  return (
    <div className={`pointer-events-none absolute rounded-sm ${tone === "edit" ? "border border-dashed border-primary/50" : "border-2 border-primary-soft"}`} style={boxStyle(box)}>
      <span className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-[9px] font-black ${tone === "edit" ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`}>{label}</span>
    </div>
  );
}

function textPreviewStyle(field: BusinessCardTemplateTextElement, renderPixelScale: number, value: string, trimWidthScale: number): CSSProperties {
  return {
    color: field.color,
    fontFamily: fontFamilies[field.fontFamily],
    fontSize: `${fittedBusinessCardFontSizePx(field, value, renderPixelScale, field.box.width, 16 * renderPixelScale, trimWidthScale)}px`,
    fontStyle: field.italic ? "italic" : undefined,
    fontWeight: field.fontWeight === "bold" ? 900 : 400,
    lineHeight: 1.3,
    textAlign: field.align,
  };
}

function TextFieldPreview({ field, selected, renderPixelScale, trimWidthScale, onDoubleClick, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { field: BusinessCardTemplateTextElement; selected: boolean; renderPixelScale: number; trimWidthScale: number; onDoubleClick: () => void; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  const value = displayFieldValue(field);

  return (
    <div className={`absolute touch-none cursor-grab overflow-hidden rounded-sm border transition active:cursor-grabbing ${fontPreviewClasses[field.fontFamily]} ${selected ? "border-primary bg-surface/20 shadow-soft ring-2 ring-primary-soft" : "border-transparent bg-transparent hover:border-primary-soft/50"}`} style={{ ...boxStyle(field.box), ...textPreviewStyle(field, renderPixelScale, value, trimWidthScale), padding: `0 ${formatPercent(8 * renderPixelScale, 4)}px` }} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <span className="block overflow-hidden whitespace-nowrap">{value}</span>
      {selected ? <ResizeHandles onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} /> : null}
    </div>
  );
}

const infoBlockLabels: Record<string, string> = {
  contact: "연락처 영역",
  email: "이메일 영역",
  website: "도메인 영역",
  address: "주소 영역",
};

function InfoBlockMovePreview({ block, selected, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: { block: BusinessCardInfoBlock; selected: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <div className={`absolute z-20 touch-none cursor-grab rounded-sm border transition active:cursor-grabbing ${selected ? "border-primary bg-primary-soft/15 shadow-soft ring-2 ring-primary-soft" : "border-transparent bg-transparent hover:border-primary-soft/80 hover:bg-primary-soft/10"}`} style={boxStyle(block.box)} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {selected ? <span className="absolute -top-6 left-0 rounded-sm bg-primary px-2 py-1 text-[9px] font-black text-white shadow-soft">{infoBlockLabels[block.id] ?? "정보 영역"}</span> : null}
    </div>
  );
}

function LinePreview({ line, selected, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { line: BusinessCardTemplateLineElement; selected: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <div className={`absolute touch-none cursor-grab rounded-sm border transition active:cursor-grabbing ${selected ? "border-primary shadow-soft ring-2 ring-primary-soft" : "border-transparent hover:border-primary-soft/50"}`} style={{ ...boxStyle(line.box), backgroundColor: line.color }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {selected ? <ResizeHandles onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} /> : null}
    </div>
  );
}

function IconPreview({ icon, selected, cssPixelScale, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { icon: BusinessCardTemplateIconElement; selected: boolean; cssPixelScale: number; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);

  return (
    <div className={`absolute touch-none cursor-grab overflow-hidden rounded-sm transition active:cursor-grabbing ${selected ? "border-primary bg-surface/20 shadow-soft ring-2 ring-primary-soft" : "border-transparent bg-transparent hover:border-primary-soft/50"}`} style={{ ...boxStyle(icon.box), borderStyle: "solid", borderWidth: `${iconChrome.borderWidthPx}px`, color: icon.color, padding: `${iconChrome.paddingPx}px` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {iconMarkup(icon.icon)}
      {selected ? <ResizeHandles onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} /> : null}
    </div>
  );
}

function ResizeHandles({ onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <>
      {resizeCorners.map((item) => (
        <span key={item.corner} className={`absolute z-10 h-3 w-3 rounded-sm border border-primary bg-surface shadow-soft ring-1 ring-primary-soft transition hover:scale-110 ${item.className} ${item.cursorClassName}`} aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, item.corner)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
      ))}
    </>
  );
}

function QuickControls({ selectedItem, position, field, icon, line, logo, infoBlock, onPositionChange, onFieldChange, onIconChange, onLineChange, onLogoChange, onInfoBlockChange, onInfoBlockFieldsChange, onInfoBlockFieldChange, onInfoBlockIconChange }: { selectedItem: SelectedItem; position: ControlsPosition; field?: BusinessCardTemplateTextElement; icon?: BusinessCardTemplateIconElement; line?: BusinessCardTemplateLineElement; logo?: BusinessCardTemplateLogoElement; infoBlock?: BusinessCardInfoBlock; onPositionChange: (position: ControlsPosition) => void; onFieldChange: (updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void; onIconChange: (updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => void; onLineChange: (updater: (line: BusinessCardTemplateLineElement) => BusinessCardTemplateLineElement) => void; onLogoChange: (updater: (logo: BusinessCardTemplateLogoElement) => BusinessCardTemplateLogoElement) => void; onInfoBlockChange: (updater: (box: BusinessCardTemplateBox) => BusinessCardTemplateBox) => void; onInfoBlockFieldsChange: (updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void; onInfoBlockFieldChange: (fieldId: BusinessCardTemplateTextFieldId, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void; onInfoBlockIconChange: (updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => void }) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | undefined>(undefined);
  const controlsStyle: CSSProperties = { left: `${position.x}px`, top: `${position.y}px` };

  const startControlsDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: position.x, startY: position.y };
  };

  const moveControlsDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    onPositionChange({
      x: dragRef.current.startX + event.clientX - dragRef.current.startClientX,
      y: dragRef.current.startY + event.clientY - dragRef.current.startClientY,
    });
  };

  const stopControlsDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    dragRef.current = undefined;
  };

  if (selectedItem.type === "info-block" && infoBlock) {
    const blockFields = infoBlock.rows.flatMap((row) => row.items.map((item) => item.field));
    const firstField = blockFields[0];
    const allVisible = blockFields.every((blockField) => blockField.visible);
    const iconTextGapPx = infoBlock.icon?.textGapPx ?? businessCardInfoBlockIconTextGapPx;

    return (
      <div ref={controlsRef} className="absolute z-20 grid w-[430px] max-w-[calc(100%-1.5rem)] gap-2 rounded-lg border border-line bg-surface/95 p-2 shadow-card backdrop-blur" style={controlsStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-move select-none text-[11px] font-black text-primary-strong" onPointerDown={startControlsDrag} onPointerMove={moveControlsDrag} onPointerUp={stopControlsDrag} onPointerCancel={stopControlsDrag}>{infoBlockLabels[infoBlock.id] ?? "정보 영역"}</span>
          <CheckboxPill label="표시" checked={allVisible} onChange={(visible) => onInfoBlockFieldsChange((current) => ({ ...current, visible }))} />
        </div>
        {firstField ? (
          <div className="grid grid-cols-[72px_48px_98px_38px_46px] items-end gap-1">
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-soft">폰트</span>
              <select className="h-8 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" value={firstField.fontFamily} onChange={(event) => onInfoBlockFieldsChange((current) => ({ ...current, fontFamily: readFontFamily(event.target.value) }))}>
                {businessCardTemplateFontFamilies.map((fontFamily) => <option key={fontFamily} value={fontFamily}>{fontLabels[fontFamily]}</option>)}
              </select>
            </label>
            <CompactNumberInput label="크기" value={firstField.fontSize} min={6} max={36} step={1} onChange={(value) => onInfoBlockFieldsChange((current) => ({ ...current, fontSize: roundPercent(clamp(value, 6, 36)) }))} />
            <CompactColorInput label="색" value={firstField.color} onChange={(color) => onInfoBlockFieldsChange((current) => ({ ...current, color }))} />
            <button className={`h-8 rounded-sm px-1 text-[10px] font-black ${firstField.fontWeight === "bold" ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onInfoBlockFieldsChange((current) => ({ ...current, fontWeight: firstField.fontWeight === "bold" ? "regular" : "bold" }))}>굵게</button>
            <button className={`h-8 rounded-sm px-1 text-[10px] font-black italic whitespace-nowrap ${firstField.italic ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onInfoBlockFieldsChange((current) => ({ ...current, italic: !firstField.italic }))}>이탤릭</button>
          </div>
        ) : null}
        <div className="grid gap-1">
          {blockFields.map((blockField) => (
            <label key={blockField.id} className="grid grid-cols-[76px_1fr] items-center gap-2">
              <span className="text-[10px] font-extrabold text-soft">{fieldLabels[blockField.id]}</span>
              <input className="h-8 rounded-sm border border-line bg-surface px-2 text-xs font-black text-ink outline-none focus:border-primary" defaultValue={editableBusinessCardFieldValue(blockField.id, blockField.customValue ?? sampleFieldValue(blockField.id))} onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                onInfoBlockFieldChange(blockField.id, (current) => (value ? { ...current, customValue: value } : { ...current, customValue: undefined }));
              }} onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-[48px_48px_48px_48px_72px] gap-1">
          <CompactNumberInput label="X" value={infoBlock.box.x} min={0} max={100 - infoBlock.box.width} step={0.01} onChange={(value) => onInfoBlockChange((box) => updateBoxValue(box, "x", value))} />
          <CompactNumberInput label="Y" value={infoBlock.box.y} min={0} max={100 - infoBlock.box.height} step={0.01} onChange={(value) => onInfoBlockChange((box) => updateBoxValue(box, "y", value))} />
          <CompactNumberInput label="가로" value={infoBlock.box.width} min={1} max={100 - infoBlock.box.x} step={0.01} onChange={(value) => onInfoBlockChange((box) => updateBoxValue(box, "width", value))} />
          <CompactNumberInput label="세로" value={infoBlock.box.height} min={1} max={100 - infoBlock.box.y} step={0.01} onChange={(value) => onInfoBlockChange((box) => updateBoxValue(box, "height", value))} />
          {infoBlock.icon ? <CompactNumberInput label="아이콘 간격" value={iconTextGapPx} min={0} max={80} step={1} onChange={(value) => onInfoBlockIconChange((current) => ({ ...current, textGapPx: roundPercent(clamp(value, 0, 80)) }))} /> : null}
        </div>
        {firstField ? (
          <div className="flex flex-wrap gap-1">
            {(["left", "center", "right"] satisfies BusinessCardTemplateTextAlign[]).map((align) => (
              <button key={align} className={`h-8 rounded-sm px-2 text-[10px] font-black ${firstField.align === align ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onInfoBlockFieldsChange((current) => ({ ...current, align }))}>{textAlignLabels[align]}</button>
            ))}
          </div>
        ) : null}
        <p className="text-[10px] font-bold leading-4 text-muted">블록 안의 텍스트와 아이콘 좌표가 함께 이동/스케일돼요.</p>
      </div>
    );
  }

  if (selectedItem.type === "field" && field) {
    return (
      <div ref={controlsRef} className="absolute z-20 grid w-[390px] max-w-[calc(100%-1.5rem)] gap-2 rounded-lg border border-line bg-surface/95 p-2 shadow-card backdrop-blur" style={controlsStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-move select-none text-[11px] font-black text-primary-strong" onPointerDown={startControlsDrag} onPointerMove={moveControlsDrag} onPointerUp={stopControlsDrag} onPointerCancel={stopControlsDrag}>{fieldLabels[field.id]} 텍스트</span>
          <CheckboxPill label="표시" checked={field.visible} onChange={(visible) => onFieldChange((current) => ({ ...current, visible }))} />
        </div>
        <div className="grid grid-cols-[72px_48px_98px_38px_46px] items-end gap-1">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold text-soft">폰트</span>
            <select className="h-8 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" value={field.fontFamily} onChange={(event) => onFieldChange((current) => ({ ...current, fontFamily: readFontFamily(event.target.value) }))}>
              {businessCardTemplateFontFamilies.map((fontFamily) => <option key={fontFamily} value={fontFamily}>{fontLabels[fontFamily]}</option>)}
            </select>
          </label>
          <CompactNumberInput label="크기" value={field.fontSize} min={6} max={36} step={1} onChange={(value) => onFieldChange((current) => ({ ...current, fontSize: roundPercent(clamp(value, 6, 36)) }))} />
          <CompactColorInput label="색" value={field.color} onChange={(color) => onFieldChange((current) => ({ ...current, color }))} />
          <button className={`h-8 rounded-sm px-1 text-[10px] font-black ${field.fontWeight === "bold" ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onFieldChange((current) => ({ ...current, fontWeight: current.fontWeight === "bold" ? "regular" : "bold" }))}>굵게</button>
          <button className={`h-8 rounded-sm px-1 text-[10px] font-black italic whitespace-nowrap ${field.italic ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onFieldChange((current) => ({ ...current, italic: !current.italic }))}>이탤릭</button>
        </div>
        <div className="grid grid-cols-[48px_48px_48px_48px] gap-1">
          <CompactNumberInput label="X" value={field.box.x} min={0} max={100 - field.box.width} step={0.01} onChange={(value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, "x", value) }))} />
          <CompactNumberInput label="Y" value={field.box.y} min={0} max={100 - field.box.height} step={0.01} onChange={(value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, "y", value) }))} />
          <CompactNumberInput label="가로" value={field.box.width} min={1} max={100 - field.box.x} step={0.01} onChange={(value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, "width", value) }))} />
          <CompactNumberInput label="세로" value={field.box.height} min={1} max={100 - field.box.y} step={0.01} onChange={(value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, "height", value) }))} />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["left", "center", "right"] satisfies BusinessCardTemplateTextAlign[]).map((align) => (
            <button key={align} className={`h-8 rounded-sm px-2 text-[10px] font-black ${field.align === align ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => onFieldChange((current) => ({ ...current, align }))}>{textAlignLabels[align]}</button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedItem.type === "icon" && icon) {
    return (
      <div ref={controlsRef} className="absolute z-20 grid w-[330px] max-w-[calc(100%-1.5rem)] gap-2 rounded-lg border border-line bg-surface/95 p-2 shadow-card backdrop-blur" style={controlsStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-move select-none text-[11px] font-black text-primary-strong" onPointerDown={startControlsDrag} onPointerMove={moveControlsDrag} onPointerUp={stopControlsDrag} onPointerCancel={stopControlsDrag}>아이콘</span>
          <CheckboxPill label="표시" checked={icon.visible} onChange={(visible) => onIconChange((current) => ({ ...current, visible }))} />
        </div>
        <div className="grid grid-cols-[92px_98px] items-end gap-1">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold text-soft">아이콘 종류</span>
            <select className="h-8 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" value={icon.icon} onChange={(event) => onIconChange((current) => ({ ...current, icon: readIconId(event.target.value) }))}>
              {businessCardTemplateIconIds.map((iconId) => <option key={iconId} value={iconId}>{iconLabels[iconId]}</option>)}
            </select>
          </label>
          <CompactColorInput label="색" value={icon.color} onChange={(color) => onIconChange((current) => ({ ...current, color }))} />
        </div>
        <div className="grid grid-cols-[48px_48px_48px_48px] gap-1">
          <CompactNumberInput label="X" value={icon.box.x} min={0} max={100 - icon.box.width} step={0.01} onChange={(value) => onIconChange((current) => ({ ...current, box: updateBoxValue(current.box, "x", value) }))} />
          <CompactNumberInput label="Y" value={icon.box.y} min={0} max={100 - icon.box.height} step={0.01} onChange={(value) => onIconChange((current) => ({ ...current, box: updateBoxValue(current.box, "y", value) }))} />
          <CompactNumberInput label="가로" value={icon.box.width} min={1} max={100 - icon.box.x} step={0.01} onChange={(value) => onIconChange((current) => ({ ...current, box: updateBoxValue(current.box, "width", value) }))} />
          <CompactNumberInput label="세로" value={icon.box.height} min={1} max={100 - icon.box.y} step={0.01} onChange={(value) => onIconChange((current) => ({ ...current, box: updateBoxValue(current.box, "height", value) }))} />
        </div>
      </div>
    );
  }

  if (selectedItem.type === "line" && line) {
    const isHorizontal = line.orientation === "horizontal";

    return (
      <div ref={controlsRef} className="absolute z-20 grid w-[330px] max-w-[calc(100%-1.5rem)] gap-2 rounded-lg border border-line bg-surface/95 p-2 shadow-card backdrop-blur" style={controlsStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-move select-none text-[11px] font-black text-primary-strong" onPointerDown={startControlsDrag} onPointerMove={moveControlsDrag} onPointerUp={stopControlsDrag} onPointerCancel={stopControlsDrag}>라인</span>
          <CheckboxPill label="표시" checked={line.visible} onChange={(visible) => onLineChange((current) => ({ ...current, visible }))} />
        </div>
        <div className="grid grid-cols-[76px_98px] items-end gap-1">
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold text-soft">방향</span>
            <select className="h-8 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" value={line.orientation} onChange={(event) => onLineChange((current) => ({ ...current, orientation: event.target.value === "vertical" ? "vertical" : "horizontal" }))}>
              <option value="horizontal">가로</option>
              <option value="vertical">세로</option>
            </select>
          </label>
          <CompactColorInput label="색" value={line.color} onChange={(color) => onLineChange((current) => ({ ...current, color }))} />
        </div>
        <div className="grid grid-cols-[48px_48px_48px_48px] gap-1">
          <CompactNumberInput label="X" value={line.box.x} min={0} max={100 - line.box.width} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateBoxValue(current.box, "x", value) }))} />
          <CompactNumberInput label="Y" value={line.box.y} min={0} max={100 - line.box.height} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateBoxValue(current.box, "y", value) }))} />
          <CompactNumberInput label="길이" value={isHorizontal ? line.box.width : line.box.height} min={0.25} max={isHorizontal ? 100 - line.box.x : 100 - line.box.y} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateLineBoxValue(current.box, isHorizontal ? "width" : "height", value) }))} />
          <CompactNumberInput label="두께" value={isHorizontal ? line.box.height : line.box.width} min={0.25} max={20} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateLineBoxValue(current.box, isHorizontal ? "height" : "width", value) }))} />
        </div>
      </div>
    );
  }

  if (selectedItem.type === "logo" && logo) {
    return (
      <div ref={controlsRef} className="absolute z-20 grid w-[237px] max-w-[calc(100%-1.5rem)] gap-2 rounded-lg border border-line bg-surface/95 p-2 shadow-card backdrop-blur" style={controlsStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="cursor-move select-none text-[11px] font-black text-primary-strong" onPointerDown={startControlsDrag} onPointerMove={moveControlsDrag} onPointerUp={stopControlsDrag} onPointerCancel={stopControlsDrag}>로고 박스</span>
          <CheckboxPill label="표시" checked={logo.visible} onChange={(visible) => onLogoChange((current) => ({ ...current, visible }))} />
        </div>
        <div className="grid grid-cols-[48px_48px_48px_48px] gap-1">
          <CompactNumberInput label="X" value={logo.box.x} min={0} max={100 - logo.box.width} step={0.01} onChange={(value) => onLogoChange((current) => ({ ...current, box: updateBoxValue(current.box, "x", value) }))} />
          <CompactNumberInput label="Y" value={logo.box.y} min={0} max={100 - logo.box.height} step={0.01} onChange={(value) => onLogoChange((current) => ({ ...current, box: updateBoxValue(current.box, "y", value) }))} />
          <CompactNumberInput label="가로" value={logo.box.width} min={1} max={100 - logo.box.x} step={0.01} onChange={(value) => onLogoChange((current) => ({ ...current, box: updateBoxValue(current.box, "width", value) }))} />
          <CompactNumberInput label="세로" value={logo.box.height} min={1} max={100 - logo.box.y} step={0.01} onChange={(value) => onLogoChange((current) => ({ ...current, box: updateBoxValue(current.box, "height", value) }))} />
        </div>
      </div>
    );
  }

  return null;
}

function BoxControls({ box, onChange }: { box: BusinessCardTemplateBox; onChange: (key: BoxKey, value: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <NumberInput label="X" value={box.x} min={0} max={100 - box.width} step={0.01} onChange={(value) => onChange("x", value)} />
      <NumberInput label="Y" value={box.y} min={0} max={100 - box.height} step={0.01} onChange={(value) => onChange("y", value)} />
      <NumberInput label="가로" value={box.width} min={1} max={100 - box.x} step={0.01} onChange={(value) => onChange("width", value)} />
      <NumberInput label="세로" value={box.height} min={1} max={100 - box.y} step={0.01} onChange={(value) => onChange("height", value)} />
    </div>
  );
}

function NumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const commitValue = (input: HTMLInputElement) => {
    const nextValue = Number(input.value.trim().replace(",", "."));

    if (Number.isFinite(nextValue)) {
      onChange(roundPercent(clamp(nextValue, min, max)));
      return;
    }

    input.value = String(value);
  };

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <input key={`${label}-${value}`} className="w-full rounded-md border border-line bg-surface px-3 py-3 text-sm font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" type="text" inputMode="decimal" defaultValue={value} onBlur={(event) => commitValue(event.currentTarget)} onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }} data-step={step} />
    </label>
  );
}

function CompactNumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const commitValue = (input: HTMLInputElement) => {
    const nextValue = Number(input.value.trim().replace(",", "."));

    if (Number.isFinite(nextValue)) {
      onChange(roundPercent(clamp(nextValue, min, max)));
      return;
    }

    input.value = String(value);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold text-soft">{label}</span>
      <input key={`${label}-${value}`} className="h-9 w-full rounded-sm border border-line bg-surface px-2 text-xs font-black text-ink outline-none focus:border-primary" type="text" inputMode="decimal" defaultValue={value} onBlur={(event) => commitValue(event.currentTarget)} onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }} data-step={step} />
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const commitValue = (input: HTMLInputElement) => {
    const color = normalizeHexColorInput(input.value);

    if (color) {
      onChange(color);
      return;
    }

    input.value = value;
  };

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <div className="grid grid-cols-[44px_1fr] gap-2">
        <input className="h-11 w-full cursor-pointer rounded-md border border-line bg-surface p-1 outline-none transition focus:border-primary focus:shadow-soft" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input key={`${label}-${value}`} className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" type="text" defaultValue={value} onBlur={(event) => commitValue(event.currentTarget)} onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }} />
      </div>
    </label>
  );
}

function CompactColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const commitValue = (input: HTMLInputElement) => {
    const color = normalizeHexColorInput(input.value);

    if (color) {
      onChange(color);
      return;
    }

    input.value = value;
  };

  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold text-soft">{label}</span>
      <div className="grid grid-cols-[32px_64px] gap-1">
        <input className="h-8 w-full cursor-pointer rounded-sm border border-line bg-surface p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input key={`${label}-${value}`} className="h-8 w-full rounded-sm border border-line bg-surface px-1 text-[10px] font-black text-ink outline-none focus:border-primary" type="text" defaultValue={value} onBlur={(event) => commitValue(event.currentTarget)} onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }} />
      </div>
    </label>
  );
}

function CheckboxPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs font-black transition ${checked ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong"}`}>
      <input className="h-4 w-4 accent-primary" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function readFontFamily(value: string): BusinessCardTemplateFontFamily {
  return businessCardTemplateFontFamilies.find((fontFamily) => fontFamily === value) ?? "sans";
}

function readIconId(value: string): BusinessCardTemplateIconId {
  return businessCardTemplateIconIds.find((iconId) => iconId === value) ?? "phone";
}
