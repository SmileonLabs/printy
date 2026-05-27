"use client";

import Image from "next/image";
import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { businessCardInfoBlockLabels, QuickControls } from "@/components/admin/business-card-layout-quick-controls";
import { BusinessCardInfoBlockRenderer } from "@/components/business-card-info-block-renderer";
import { CanvasEditorQrImageControl, CanvasEditorReadOnlyPreviewFrame, CanvasEditorSelectableOverlayBox } from "@/components/design-production/canvas-editor-control-primitives";
import { canvasEditorKeyboardMoveDelta, isCanvasEditorCopyShortcut, isCanvasEditorDeleteShortcut, isCanvasEditorFormTarget, isCanvasEditorUndoShortcut, useCanvasEditorHistory, useCanvasEditorPointerDrag } from "@/components/design-production/canvas-editor-interactions";
import { CanvasEditorCheckboxPill as CheckboxPill, CanvasEditorElementPanel, CanvasEditorSelectableBox, CanvasEditorZoomFrame, SharedCanvasEditorModule, canvasEditorBackgroundGridActions, canvasEditorBasicIconActions, canvasEditorCoreElementActions, canvasEditorMappedElementActions, type CanvasEditorResizeCorner, type CanvasElementPanelPlacement } from "@/components/design-production/canvas-editor-panels";
import { businessCardTemplateFieldIds, businessCardTemplateIconArtwork, businessCardTemplateIconIds, defaultBusinessCardTemplateLayout } from "@/lib/business-card-templates";
import { businessCardIconChromeStyle, businessCardTrimWidthScale, displayBusinessCardFieldValue, editableBusinessCardFieldValue, fontFamilies, formatPercent, getBusinessCardTrimMetrics, isMultilineBusinessCardTextFieldId, resolveBusinessCardContactLayout, sampleBusinessCardFieldValue, type BusinessCardContactLayout, type BusinessCardInfoBlock } from "@/lib/business-card-rendering";
import { canvasBoxStyle, clampCanvasValue, moveCanvasBox, resizeCanvasBox, resizeCanvasTextBoxToContent, roundCanvasPercent, snapCanvasPercent, updateCanvasBoxValue } from "@/lib/design-projects";
import { designTextBoxFontSizeCss, designTextLineHeight } from "@/lib/design-projects/text-sizing";
import { textColorStyle } from "@/lib/text-color-effects";
import type { BusinessCardTemplateBox, BusinessCardTemplateFontFamily, BusinessCardTemplateIconElement, BusinessCardTemplateIconId, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateSideId, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId, Member, ResolvedLogoOption } from "@/lib/types";

type BusinessCardLayoutBuilderProps = {
  layout: BusinessCardTemplateLayout;
  orientation: "horizontal" | "vertical";
  managedBackgrounds: BusinessCardLayoutManagedBackground[];
  mode?: "admin" | "user";
  userFieldValues?: Partial<Record<BusinessCardTemplateTextFieldId, string>>;
  userQrCodeImageUrl?: string;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  cleanPreviewImageUrl?: string;
  activeSideId?: BusinessCardTemplateSideId;
  onActiveSideChange?: (sideId: BusinessCardTemplateSideId) => void;
  onOrientationChange?: (orientation: "horizontal" | "vertical") => void;
  onUserFieldValueChange?: (fieldId: BusinessCardTemplateTextFieldId, value: string) => void;
  onUserQrCodeImageChange?: (file: File | undefined) => void;
  onUserQrCodeImageClear?: () => void;
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
type BoxKey = keyof BusinessCardTemplateBox;
type ResizeCorner = CanvasEditorResizeCorner;
type SelectedItem = { type: "field"; fieldId: BusinessCardTemplateTextFieldId } | { type: "logo" } | { type: "icon"; iconId: string } | { type: "line"; lineId: string } | { type: "info-block"; blockId: string };
type ControlsPosition = { x: number; y: number };
type UserExpandableFieldId = BusinessCardTemplateTextFieldId;

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

const fixedFieldLabels: Record<Exclude<BusinessCardTemplateTextFieldId, `headline-${number}` | `body-${number}`>, string> = {
  role: "직함",
  name: "이름",
  phone: "전화번호",
  mainPhone: "대표전화",
  fax: "팩스",
  email: "이메일",
  website: "웹도메인",
  address: "주소",
  account: "계좌번호",
  instagram: "인스타그램",
  qrCode: "QR 코드",
};

function fieldLabel(fieldId: BusinessCardTemplateTextFieldId) {
  if (fieldId.startsWith("headline-")) return `문구 ${fieldId.replace("headline-", "")}`;
  if (fieldId.startsWith("body-")) return `상세 안내 ${fieldId.replace("body-", "")}`;
  return fixedFieldLabels[fieldId as keyof typeof fixedFieldLabels];
}

const fontPreviewClasses: Record<BusinessCardTemplateFontFamily, string> = {
  sans: "font-sans",
  serif: "font-serif",
  rounded: "font-display",
  mono: "font-mono",
  display: "font-display",
  handwriting: "font-display italic",
};

const sideIds: BusinessCardTemplateSideId[] = ["front", "back"];
const defaultIconColor = "#075dcb";
const defaultLineColor = "#111827";
const gridStep = 2.5;
const userExpandableFieldIds: UserExpandableFieldId[] = ["qrCode"];

function clamp(value: number, min: number, max: number) {
  return clampCanvasValue(value, min, max);
}

function roundPercent(value: number) {
  return roundCanvasPercent(value);
}

function snapPercent(value: number) {
  return snapCanvasPercent(value, gridStep);
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ").replace(/\r/g, "");
}

function cssUrl(value: string) {
  return `url("${escapeCssString(value.trim())}")`;
}

function boxStyle(box: BusinessCardTemplateBox): CSSProperties {
  return canvasBoxStyle(box);
}

function updateBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  return updateCanvasBoxValue(box, key, value, { minWidth: 10, maxWidth: 100, minHeight: 1, maxHeight: 100, minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function moveBox(box: BusinessCardTemplateBox, deltaX: number, deltaY: number): BusinessCardTemplateBox {
  return moveCanvasBox(box, deltaX, deltaY, { minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function snapBoxTopLeft(box: BusinessCardTemplateBox): BusinessCardTemplateBox {
  return {
    ...box,
    x: roundPercent(clamp(snapPercent(box.x), -100, 100)),
    y: roundPercent(clamp(snapPercent(box.y), -100, 100)),
  };
}

function resizeBox(box: BusinessCardTemplateBox, corner: ResizeCorner, deltaX: number, deltaY: number): BusinessCardTemplateBox {
  return resizeCanvasBox(box, corner, deltaX, deltaY, { minWidth: 10, maxWidth: 100, minHeight: 1, maxHeight: 100 });
}

function resizeIconBox(box: BusinessCardTemplateBox, corner: ResizeCorner, deltaX: number, deltaY: number): BusinessCardTemplateBox {
  return resizeCanvasBox(box, corner, deltaX, deltaY, { minWidth: 1, maxWidth: 100, minHeight: 1, maxHeight: 100 });
}

function resizeTextBoxToContent(box: BusinessCardTemplateBox, corner: ResizeCorner, deltaX: number, deltaY: number, trim: { widthMm: number; heightMm: number }, value: string): BusinessCardTemplateBox {
  return resizeCanvasTextBoxToContent(box, corner, deltaX, deltaY, { pageWidthMm: trim.widthMm, pageHeightMm: trim.heightMm, value, minWidth: 10, maxWidth: 100, minHeight: 1, maxHeight: 100 });
}

function sampleFieldValue(fieldId: BusinessCardTemplateTextFieldId) {
  return sampleBusinessCardFieldValue(fieldId);
}

function editableFieldValue(field: BusinessCardTemplateTextElement) {
  const value = field.customValue ?? sampleFieldValue(field.id);

  return editableBusinessCardFieldValue(field.id, value);
}

function displayFieldValue(field: BusinessCardTemplateTextElement) {
  const value = field.customValue ?? sampleFieldValue(field.id);

  return displayBusinessCardFieldValue(field.id, value);
}

function isQrCodeImageSource(value: string) {
  return value.startsWith("data:image/") || value.startsWith("/uploads/") || /^https?:\/\//i.test(value);
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

function getField(layout: BusinessCardTemplateLayout, sideId: BusinessCardTemplateSideId, fieldId: BusinessCardTemplateTextFieldId): BusinessCardTemplateTextElement {
  const matchingField = layout.sides[sideId].fields.find((field) => field.id === fieldId);

  if (matchingField) {
    return matchingField;
  }

  const defaultField = defaultBusinessCardTemplateLayout.sides[sideId].fields.find((field) => field.id === fieldId);

  return defaultField ? { ...defaultField, visible: false, box: { ...defaultField.box } } : { id: fieldId, visible: false, box: { x: 0, y: 0, width: 1, height: 1 }, fontFamily: "sans", fontSize: 18, color: "#111827", fontWeight: "bold", italic: false, align: "left" };
}

function isDynamicBusinessCardField(fieldId: BusinessCardTemplateTextFieldId) {
  return fieldId.startsWith("headline-") || fieldId.startsWith("body-");
}

function nextDynamicFieldId(fields: BusinessCardTemplateTextElement[], kind: "headline" | "body"): BusinessCardTemplateTextFieldId {
  const nextNumber = fields.filter((field) => field.id.startsWith(`${kind}-`)).length + 1;
  return `${kind}-${nextNumber}` as BusinessCardTemplateTextFieldId;
}

function makeDynamicField(fields: BusinessCardTemplateTextElement[], kind: "headline" | "body"): BusinessCardTemplateTextElement {
  const id = nextDynamicFieldId(fields, kind);
  const index = fields.filter((field) => field.id.startsWith(`${kind}-`)).length;

  return {
    id,
    visible: true,
    box: kind === "headline" ? { x: 12, y: 12 + index * 9, width: 76, height: 9 } : { x: 14, y: 42 + index * 10, width: 72, height: 12 },
    fontFamily: "sans",
    fontSize: kind === "headline" ? 16 : 10,
    color: "#111827",
    fontWeight: kind === "headline" ? "bold" : "regular",
    italic: false,
    align: "center",
    customValue: kind === "headline" ? "문구" : "상세 안내",
  };
}

function copyDynamicField(field: BusinessCardTemplateTextElement, fields: BusinessCardTemplateTextElement[]): BusinessCardTemplateTextElement | undefined {
  const kind = field.id.startsWith("headline-") ? "headline" : field.id.startsWith("body-") ? "body" : undefined;
  if (!kind) return undefined;

  return { ...field, id: nextDynamicFieldId(fields, kind), visible: true, box: moveBox(field.box, 2.5, 2.5) };
}

function iconMarkup(iconId: BusinessCardTemplateIconId, className = "block h-full w-full") {
  const icon = businessCardTemplateIconArtwork[iconId];

  return (
    <svg className={className} viewBox={icon.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}

export function BusinessCardLayoutBuilder({ layout, orientation, managedBackgrounds, mode = "admin", userFieldValues, userQrCodeImageUrl = "", logoImageUrl, logoVectorSvgUrl, cleanPreviewImageUrl, activeSideId, onActiveSideChange, onOrientationChange, onUserFieldValueChange, onUserQrCodeImageChange, onUserQrCodeImageClear, onChange }: BusinessCardLayoutBuilderProps) {
  const [activeSideState, setActiveSideState] = useState<BusinessCardTemplateSideId>("front");
  const [selectedItem, setSelectedItem] = useState<SelectedItem | undefined>({ type: "field", fieldId: "name" });
  const [controlsPosition, setControlsPosition] = useState<ControlsPosition>({ x: 24, y: 132 });
  const dragController = useCanvasEditorPointerDrag<DragState>();
  const dragState = dragController.dragState;
  const [showGrid, setShowGrid] = useState(true);
  const [expandedUserFieldId, setExpandedUserFieldId] = useState<UserExpandableFieldId>();
  const history = useCanvasEditorHistory({ value: layout, onChange });
  const layoutRef = useRef(layout);
  const qrAutoVisibleRef = useRef(false);
  const touchTapRef = useRef<{ key: string; time: number } | undefined>(undefined);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeSide = activeSideId ?? activeSideState;
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
  const selectedControlsPosition = controlsPosition;
  const [canvasScale, setCanvasScale] = useState(1);
  const renderPixelScale = cssPixelScale * canvasScale;
  const readUserFieldValue = (fieldId: BusinessCardTemplateTextFieldId) => userFieldValues?.[fieldId]?.trim() || undefined;
  const readFieldValue = (field: BusinessCardTemplateTextElement) => field.id === "qrCode" && userQrCodeImageUrl ? userQrCodeImageUrl : readUserFieldValue(field.id) ?? field.customValue ?? sampleFieldValue(field.id);
  const contactLayout = resolveBusinessCardContactLayout(side.fields, side.icons, readFieldValue);
  const selectedInfoBlock = selectedItem?.type === "info-block" ? contactLayout.blocks.find((block) => block.id === selectedItem.blockId) : undefined;
  const isUserMode = mode === "user";
  const activeLogoUrl = side.logo.assetType === "svg" && logoVectorSvgUrl ? logoVectorSvgUrl : logoImageUrl;
  const hasCleanPreviewImage = isUserMode && Boolean(cleanPreviewImageUrl);
  const cleanPreviewBackgroundStyle: CSSProperties | undefined = hasCleanPreviewImage && cleanPreviewImageUrl ? { backgroundImage: cssUrl(cleanPreviewImageUrl), backgroundSize: "100% 200%", backgroundPosition: activeSide === "front" ? "center top" : "center bottom", backgroundRepeat: "no-repeat" } : undefined;
  const expandedUserField = expandedUserFieldId ? getField(layout, activeSide, expandedUserFieldId) : undefined;
  const isExpandedUserFieldVisible = Boolean(expandedUserField?.visible);
  const isQrCodeVisible = getField(layout, activeSide, "qrCode").visible;
  const canvasSizeStyle: CSSProperties = { width: "100%" };

  const changeActiveSide = (sideId: BusinessCardTemplateSideId) => {
    setActiveSideState(sideId);
    onActiveSideChange?.(sideId);
    setSelectedItem(layout.sides[sideId].logo.visible ? { type: "logo" } : undefined);
  };

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
      const target = event.target;
      const isFormTarget = isCanvasEditorFormTarget(target);

      if (isCanvasEditorCopyShortcut(event)) {
        if (isFormTarget || selectedItem?.type !== "field") return;

        const currentLayout = layoutRef.current;
        const currentSide = currentLayout.sides[activeSide];
        const field = currentSide.fields.find((item) => item.id === selectedItem.fieldId);
        const copiedField = field ? copyDynamicField(field, currentSide.fields) : undefined;

        if (!copiedField) return;

        event.preventDefault();
        onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: { ...currentSide, fields: [...currentSide.fields, copiedField] } } });
        setSelectedItem({ type: "field", fieldId: copiedField.id });
        setExpandedUserFieldId(copiedField.id);
        return;
      }

      if (isCanvasEditorUndoShortcut(event)) {
        if (history.undo()) {
          event.preventDefault();
        }
        return;
      }

      const keyboardMove = canvasEditorKeyboardMoveDelta(event);

      if (keyboardMove && selectedItem && !isFormTarget) {
        const currentLayout = layoutRef.current;
        const currentSide = currentLayout.sides[activeSide];
        let nextSide = currentSide;

        if (selectedItem.type === "field") {
          nextSide = { ...currentSide, fields: currentSide.fields.map((field) => field.id === selectedItem.fieldId ? { ...field, box: moveBox(field.box, keyboardMove.x, keyboardMove.y) } : field) };
        } else if (selectedItem.type === "icon") {
          nextSide = { ...currentSide, icons: currentSide.icons.map((icon) => icon.id === selectedItem.iconId ? { ...icon, box: moveBox(icon.box, keyboardMove.x, keyboardMove.y) } : icon) };
        } else if (selectedItem.type === "line") {
          nextSide = { ...currentSide, lines: currentSide.lines.map((line) => line.id === selectedItem.lineId ? { ...line, box: moveBox(line.box, keyboardMove.x, keyboardMove.y) } : line) };
        } else if (selectedItem.type === "logo") {
          nextSide = { ...currentSide, logo: { ...currentSide.logo, box: moveBox(currentSide.logo.box, keyboardMove.x, keyboardMove.y) } };
        }

        if (nextSide !== currentSide) {
          event.preventDefault();
          onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: nextSide } });
        }

        return;
      }

      if (isCanvasEditorDeleteShortcut(event) && selectedItem) {
        if (isFormTarget) {
          return;
        }

        const currentLayout = layoutRef.current;
        const currentSide = currentLayout.sides[activeSide];

        event.preventDefault();

        if (selectedItem.type === "field") {
          onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: { ...currentSide, fields: currentSide.fields.map((field) => field.id === selectedItem.fieldId ? { ...field, visible: false } : field) } } });
          setExpandedUserFieldId((current) => current === selectedItem.fieldId ? undefined : current);
          setSelectedItem(undefined);
          return;
        }

        if (selectedItem.type === "icon") {
          onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: { ...currentSide, icons: currentSide.icons.map((icon) => icon.id === selectedItem.iconId ? { ...icon, visible: false } : icon) } } });
          setSelectedItem(undefined);
          return;
        }

        if (selectedItem.type === "line") {
          onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: { ...currentSide, lines: currentSide.lines.map((line) => line.id === selectedItem.lineId ? { ...line, visible: false } : line) } } });
          setSelectedItem(undefined);
          return;
        }

        if (selectedItem.type === "info-block") {
          const infoBlock = contactLayout.blocks.find((block) => block.id === selectedItem.blockId);

          if (infoBlock) {
            const fieldIds = new Set(infoBlock.rows.flatMap((row) => row.items.map((item) => item.field.id)));
            const iconId = infoBlock.icon?.id;

            onChange({
              ...currentLayout,
              sides: {
                ...currentLayout.sides,
                [activeSide]: {
                  ...currentSide,
                  fields: currentSide.fields.map((field) => fieldIds.has(field.id) ? { ...field, visible: false } : field),
                  icons: iconId ? currentSide.icons.map((icon) => icon.id === iconId ? { ...icon, visible: false } : icon) : currentSide.icons,
                },
              },
            });
          }

          setSelectedItem(undefined);
          return;
        }

        if (selectedItem.type === "logo") {
          onChange({ ...currentLayout, sides: { ...currentLayout.sides, [activeSide]: { ...currentSide, logo: { ...currentSide.logo, visible: false } } } });
          setSelectedItem(undefined);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSide, contactLayout.blocks, onChange, selectedItem]);

  const updateLayout = (nextLayout: BusinessCardTemplateLayout, recordHistory = true) => {
    history.updateWithHistory(nextLayout, recordHistory);
  };

  const updateActiveSide = (nextSide: typeof side, recordHistory = true) => {
    updateLayout({ ...layout, sides: { ...layout.sides, [activeSide]: nextSide } }, recordHistory);
  };

  const updateLogoBox = (nextBox: BusinessCardTemplateBox, recordHistory = true) => {
    updateActiveSide({ ...side, logo: { ...side.logo, box: nextBox } }, recordHistory);
  };

  const updateField = (fieldId: BusinessCardTemplateTextFieldId, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement, recordHistory = true) => {
    const hasField = side.fields.some((field) => field.id === fieldId);
    const nextFields = hasField ? side.fields.map((field) => (field.id === fieldId ? updater(field) : field)) : [...side.fields, updater(getField(layout, activeSide, fieldId))];

    updateActiveSide({ ...side, fields: nextFields }, recordHistory);
  };

  useEffect(() => {
    if (!isUserMode || !userQrCodeImageUrl.trim()) {
      qrAutoVisibleRef.current = false;
      return;
    }

    const qrVisibleSide = sideIds.find((sideId) => getField(layout, sideId, "qrCode").visible);

    if (qrVisibleSide) {
      qrAutoVisibleRef.current = true;
      return;
    }

    if (!qrAutoVisibleRef.current) {
      updateField("qrCode", (field) => ({ ...field, visible: true }));
      setSelectedItem({ type: "field", fieldId: "qrCode" });
      setExpandedUserFieldId("qrCode");
      qrAutoVisibleRef.current = true;
    }
  }, [activeSide, isUserMode, layout, updateField, userQrCodeImageUrl]);

  const updateIcon = (iconId: string, updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement, recordHistory = true) => {
    updateActiveSide({ ...side, icons: side.icons.map((icon) => (icon.id === iconId ? updater(icon) : icon)) }, recordHistory);
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
      x: roundPercent(clamp(box.x + deltaX, -100, 100)),
      y: roundPercent(clamp(box.y + deltaY, -100, 100)),
    });
    const resizeFieldBox = (box: BusinessCardTemplateBox): BusinessCardTemplateBox => ({
      x: roundPercent(clamp(box.x + deltaX, -100, 100)),
      y: roundPercent(clamp(box.y + deltaY, -100, 100)),
      width: roundPercent(clamp(box.width + deltaWidth, 10, 100)),
      height: roundPercent(clamp(box.height + deltaHeight, 1, 100)),
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

  const updateLine = (lineId: string, updater: (line: BusinessCardTemplateLineElement) => BusinessCardTemplateLineElement, recordHistory = true) => {
    updateActiveSide({ ...side, lines: side.lines.map((line) => (line.id === lineId ? updater(line) : line)) }, recordHistory);
  };

  const updateFieldBox = (fieldId: BusinessCardTemplateTextFieldId, key: BoxKey, value: number) => {
    updateField(fieldId, (field) => ({ ...field, box: updateBoxValue(field.box, key, value) }));
  };

  const updateFieldText = (field: BusinessCardTemplateTextElement) => {
    const nextValue = window.prompt(`${fieldLabel(field.id)} 텍스트를 입력해 주세요.`, editableFieldValue(field));

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

  const addDynamicField = (kind: "headline" | "body") => {
    const field = makeDynamicField(side.fields, kind);

    updateActiveSide({ ...side, fields: [...side.fields, field] });
    setSelectedItem({ type: "field", fieldId: field.id });
    setExpandedUserFieldId(field.id);
  };

  const updateSelectedControlsPosition = (position: ControlsPosition) => {
    setControlsPosition(position);
  };

  const readTouchPointerAction = (event: PointerEvent<HTMLElement>, key: string) => {
    if (event.pointerType !== "touch") {
      return "select-and-drag" as const;
    }

    const now = window.performance.now();
    const previousTap = touchTapRef.current;
    touchTapRef.current = { key, time: now };
    return previousTap && previousTap.key === key && now - previousTap.time < 320 ? "select-only" as const : "drag-only" as const;
  };

  const startCanvasDrag = (event: PointerEvent<HTMLElement>, nextDragState: DragStartState) => {
    history.recordHistory(layout);

    if (nextDragState.type === "logo-resize") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "logo-resize", corner: nextDragState.corner, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "field-move") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "field-move", fieldId: nextDragState.fieldId, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "info-block-move") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "info-block-move", blockId: nextDragState.block.id, startBox: nextDragState.block.box, startFields: nextDragState.block.rows.flatMap((row) => row.items.map((item) => ({ id: item.field.id, box: item.field.box }))), startIcons: nextDragState.block.icon ? [{ id: nextDragState.block.icon.id, box: nextDragState.block.icon.box }] : [] }));
      return;
    }

    if (nextDragState.type === "field-resize") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "field-resize", fieldId: nextDragState.fieldId, corner: nextDragState.corner, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "icon-move") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "icon-move", iconId: nextDragState.iconId, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "icon-resize") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "icon-resize", iconId: nextDragState.iconId, corner: nextDragState.corner, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "line-move") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "line-move", lineId: nextDragState.lineId, startBox: nextDragState.startBox }));
      return;
    }

    if (nextDragState.type === "line-resize") {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "line-resize", lineId: nextDragState.lineId, corner: nextDragState.corner, startBox: nextDragState.startBox }));
      return;
    }

    dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, type: "logo-move", startBox: nextDragState.startBox }));
  };

  const handleLogoMovePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!side.logo.visible) {
      return;
    }

    const touchAction = readTouchPointerAction(event, "logo");
    event.preventDefault();
    event.stopPropagation();

    if (touchAction !== "drag-only") {
      setSelectedItem({ type: "logo" });
    }

    if (touchAction === "select-only") {
      return;
    }

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
    const touchAction = readTouchPointerAction(event, `field:${field.id}`);

    if (touchAction !== "drag-only") {
      setSelectedItem({ type: "field", fieldId: field.id });
    }

    if (touchAction !== "drag-only" && userExpandableFieldIds.includes(field.id as UserExpandableFieldId)) {
      setExpandedUserFieldId(field.id as UserExpandableFieldId);
    }

    if (!field.visible) {
      return;
    }

    if (touchAction === "select-only") {
      return;
    }

    startCanvasDrag(event, { type: "field-move", fieldId: field.id, startBox: field.box });
  };

  const handleInfoBlockPointerDown = (event: PointerEvent<HTMLDivElement>, block: BusinessCardInfoBlock) => {
    const touchAction = readTouchPointerAction(event, `info-block:${block.id}`);

    if (touchAction !== "drag-only") {
      setSelectedItem({ type: "info-block", blockId: block.id });
    }

    if (touchAction === "select-only") {
      return;
    }

    startCanvasDrag(event, { type: "info-block-move", block });
  };

  const handleTextFieldResizePointerDown = (event: PointerEvent<HTMLSpanElement>, field: BusinessCardTemplateTextElement, corner: ResizeCorner) => {
    setSelectedItem({ type: "field", fieldId: field.id });

    if (userExpandableFieldIds.includes(field.id as UserExpandableFieldId)) {
      setExpandedUserFieldId(field.id as UserExpandableFieldId);
    }

    if (!field.visible) {
      return;
    }

    event.stopPropagation();
    startCanvasDrag(event, { type: "field-resize", fieldId: field.id, corner, startBox: field.box });
  };

  const handleIconPointerDown = (event: PointerEvent<HTMLDivElement>, icon: BusinessCardTemplateIconElement) => {
    const touchAction = readTouchPointerAction(event, `icon:${icon.id}`);

    if (touchAction !== "drag-only") {
      setSelectedItem({ type: "icon", iconId: icon.id });
    }

    if (icon.visible) {
      if (touchAction === "select-only") {
        return;
      }

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
    const touchAction = readTouchPointerAction(event, `line:${line.id}`);

    if (touchAction !== "drag-only") {
      setSelectedItem({ type: "line", lineId: line.id });
    }

    if (line.visible) {
      if (touchAction === "select-only") {
        return;
      }

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
    const dragDelta = dragController.readPointerDragDelta(event);

    if (!dragDelta) {
      return;
    }

    const { dragState, deltaX, deltaY } = dragDelta;

    if (dragState.type === "logo-resize") {
      updateLogoBox(resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY), false);
      return;
    }

    if (dragState.type === "field-move") {
      updateField(dragState.fieldId, (field) => (field.visible ? { ...field, box: moveBox(dragState.startBox, deltaX, deltaY) } : field), false);
      return;
    }

    if (dragState.type === "info-block-move") {
      const fieldBoxes = new Map(dragState.startFields.map((item) => [item.id, moveBox(item.box, deltaX, deltaY)]));
      const iconBoxes = new Map(dragState.startIcons.map((item) => [item.id, moveBox(item.box, deltaX, deltaY)]));
      updateActiveSide({ ...side, fields: side.fields.map((field) => fieldBoxes.has(field.id) ? { ...field, box: fieldBoxes.get(field.id) ?? field.box } : field), icons: side.icons.map((icon) => iconBoxes.has(icon.id) ? { ...icon, box: iconBoxes.get(icon.id) ?? icon.box } : icon) }, false);
      return;
    }

    if (dragState.type === "field-resize") {
      updateField(dragState.fieldId, (field) => {
        if (!field.visible) return field;

        return { ...field, box: field.id === "qrCode" ? resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY) : resizeTextBoxToContent(dragState.startBox, dragState.corner, deltaX, deltaY, layout.canvas.trim, displayFieldValue(field)) };
      }, false);
      return;
    }

    if (dragState.type === "icon-move") {
      updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: moveBox(dragState.startBox, deltaX, deltaY) } : icon), false);
      return;
    }

    if (dragState.type === "icon-resize") {
      updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: resizeIconBox(dragState.startBox, dragState.corner, deltaX, deltaY) } : icon), false);
      return;
    }

    if (dragState.type === "line-move") {
      updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: moveBox(dragState.startBox, deltaX, deltaY) } : line), false);
      return;
    }

    if (dragState.type === "line-resize") {
      updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: resizeBox(dragState.startBox, dragState.corner, deltaX, deltaY) } : line), false);
      return;
    }

    updateLogoBox(moveBox(dragState.startBox, deltaX, deltaY), false);
  };

  const stopPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const dragDelta = dragController.finishPointerDrag(event);

    if (dragDelta) {
      const { dragState, deltaX, deltaY } = dragDelta;

      if (showGrid && (dragState.type === "field-move" || dragState.type === "icon-move" || dragState.type === "line-move" || dragState.type === "logo-move" || dragState.type === "info-block-move")) {
        const nextBox = snapBoxTopLeft(moveBox(dragState.startBox, deltaX, deltaY));

        if (dragState.type === "info-block-move") {
          const snappedDeltaX = nextBox.x - dragState.startBox.x;
          const snappedDeltaY = nextBox.y - dragState.startBox.y;
          const fieldBoxes = new Map(dragState.startFields.map((item) => [item.id, moveBox(item.box, snappedDeltaX, snappedDeltaY)]));
          const iconBoxes = new Map(dragState.startIcons.map((item) => [item.id, moveBox(item.box, snappedDeltaX, snappedDeltaY)]));
          updateActiveSide({ ...side, fields: side.fields.map((field) => fieldBoxes.has(field.id) ? { ...field, box: fieldBoxes.get(field.id) ?? field.box } : field), icons: side.icons.map((icon) => iconBoxes.has(icon.id) ? { ...icon, box: iconBoxes.get(icon.id) ?? icon.box } : icon) }, false);
        }

        if (dragState.type === "field-move") {
          updateField(dragState.fieldId, (field) => (field.visible ? { ...field, box: nextBox } : field), false);
        }

        if (dragState.type === "icon-move") {
          updateIcon(dragState.iconId, (icon) => (icon.visible ? { ...icon, box: nextBox } : icon), false);
        }

        if (dragState.type === "logo-move") {
          updateLogoBox(nextBox, false);
        }

        if (dragState.type === "line-move") {
          updateLine(dragState.lineId, (line) => (line.visible ? { ...line, box: nextBox } : line), false);
        }
      }
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

  const toggleUserField = (fieldId: BusinessCardTemplateTextFieldId) => {
    const field = getField(layout, activeSide, fieldId);
    const nextVisible = !field.visible;

    updateField(fieldId, (current) => ({ ...current, visible: nextVisible }));

    if (nextVisible) {
      setSelectedItem({ type: "field", fieldId });
      setExpandedUserFieldId(userExpandableFieldIds.includes(fieldId as UserExpandableFieldId) ? fieldId as UserExpandableFieldId : undefined);
      return;
    }

    if (selectedItem?.type === "field" && selectedItem.fieldId === fieldId) {
      setSelectedItem(undefined);
    }

    if (expandedUserFieldId === fieldId) {
      setExpandedUserFieldId(undefined);
    }
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
  const elementAddPlacement: CanvasElementPanelPlacement = isUserMode ? "bottom" : "top";
  const userTextFieldSection = (
    <div className="mb-4">
      <CanvasEditorElementPanel placement={elementAddPlacement} actions={[
        ...canvasEditorBackgroundGridActions({ backgroundColor: activeBackgroundColor || "#ffffff", showGrid, onBackgroundColorChange: updateActiveBackgroundColor, onShowGridChange: setShowGrid }),
        ...canvasEditorCoreElementActions({ logoActive: selectedItem?.type === "logo", onLogoAdd: () => {
          updateActiveSide({ ...side, logo: { ...side.logo, visible: true } });
          setSelectedItem({ type: "logo" });
        }, onHeadlineAdd: () => addDynamicField("headline"), onBodyAdd: () => addDynamicField("body") }),
        ...canvasEditorMappedElementActions(businessCardTemplateFieldIds, (fieldId) => {
          const field = getField(layout, activeSide, fieldId);
          const isExpandable = userExpandableFieldIds.includes(fieldId as UserExpandableFieldId);

          return { id: fieldId, label: `${fieldLabel(fieldId)}${isExpandable && expandedUserFieldId === fieldId && field.visible ? " 열림" : ""}`, active: field.visible, onClick: () => toggleUserField(fieldId) };
        }),
        ...canvasEditorMappedElementActions(side.fields.filter((field) => isDynamicBusinessCardField(field.id)), (field) => ({ id: field.id, label: fieldLabel(field.id), active: selectedItem?.type === "field" && selectedItem.fieldId === field.id, onClick: () => {
          updateField(field.id, (current) => ({ ...current, visible: true }));
          setSelectedItem({ type: "field", fieldId: field.id });
          setExpandedUserFieldId(field.id);
        } })),
      ]} />
      {expandedUserField && isExpandedUserFieldVisible && expandedUserField.id !== "qrCode" ? (
        <div className="mt-3 grid gap-3 rounded-md border border-line bg-surface-blue p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black text-primary-strong">{fieldLabel(expandedUserField.id)}</span>
            {isMultilineBusinessCardTextFieldId(expandedUserField.id) ? (
              <textarea className="min-h-20 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" placeholder={`${fieldLabel(expandedUserField.id)}을 입력해 주세요.`} value={expandedUserField.customValue ?? userFieldValues?.[expandedUserField.id] ?? ""} onChange={(event) => onUserFieldValueChange?.(expandedUserField.id, event.currentTarget.value)} />
            ) : (
              <input className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" placeholder={`${fieldLabel(expandedUserField.id)}을 입력해 주세요.`} value={expandedUserField.customValue ?? userFieldValues?.[expandedUserField.id] ?? ""} onChange={(event) => onUserFieldValueChange?.(expandedUserField.id, event.currentTarget.value)} />
            )}
          </label>
        </div>
      ) : null}
      {expandedUserFieldId === "qrCode" && isQrCodeVisible && onUserQrCodeImageChange && onUserQrCodeImageClear ? <div className="mt-3"><CanvasEditorQrImageControl value={userQrCodeImageUrl} onChange={onUserQrCodeImageChange} onClear={onUserQrCodeImageClear} /></div> : null}
    </div>
  );
  const basicIconActions = canvasEditorBasicIconActions((option) => {
    const iconId = readIconId(option.id);

    return { icon: iconMarkup(iconId), active: side.icons.some((icon) => icon.icon === iconId && icon.visible), onClick: () => toggleIcon(iconId) };
  });
  const userIconSection = <CanvasEditorElementPanel title="기본 아이콘" placement="bottom" actions={basicIconActions} collapsible defaultCollapsed />;
  const elementAddSection = isUserMode ? userTextFieldSection : <CanvasEditorElementPanel placement={elementAddPlacement} actions={[
    ...canvasEditorBackgroundGridActions({ backgroundColor: activeBackgroundColor || "#ffffff", showGrid, onBackgroundColorChange: updateActiveBackgroundColor, onShowGridChange: setShowGrid }),
    ...canvasEditorCoreElementActions({ logoActive: selectedItem?.type === "logo", onLogoAdd: () => {
      updateActiveSide({ ...side, logo: { ...side.logo, visible: true } });
      setSelectedItem({ type: "logo" });
    }, onHeadlineAdd: () => addDynamicField("headline"), onBodyAdd: () => addDynamicField("body") }),
    ...canvasEditorMappedElementActions(businessCardTemplateFieldIds, (fieldId) => {
      const field = getField(layout, activeSide, fieldId);

      return { id: fieldId, label: fieldLabel(fieldId), active: field.visible, onClick: () => {
        updateField(fieldId, (current) => ({ ...current, visible: !current.visible }));
        if (!field.visible) setSelectedItem({ type: "field", fieldId });
        else if (selectedItem?.type === "field" && selectedItem.fieldId === fieldId) setSelectedItem(undefined);
      } };
    }),
    ...canvasEditorMappedElementActions(side.fields.filter((field) => isDynamicBusinessCardField(field.id)), (field) => ({ id: field.id, label: fieldLabel(field.id), active: selectedItem?.type === "field" && selectedItem.fieldId === field.id, onClick: () => {
      updateField(field.id, (current) => ({ ...current, visible: true }));
      setSelectedItem({ type: "field", fieldId: field.id });
    } })),
  ]} />;
  const basicIconsSection = isUserMode ? userIconSection : <CanvasEditorElementPanel title="기본 아이콘" actions={basicIconActions} collapsible defaultCollapsed />;
  const previewSection = <BusinessCardReadOnlyPreview layout={layout} sideId={activeSide} contactLayout={contactLayout} activeLogoUrl={activeLogoUrl} activeBackgroundColor={activeBackgroundColor} activeBackgroundImageUrl={activeBackgroundImageUrl} cleanPreviewBackgroundStyle={cleanPreviewBackgroundStyle} readFieldValue={readFieldValue} renderPixelScale={renderPixelScale} trimWidthScale={trimWidthScale} />;

  return (
    <section className={`rounded-lg border border-line bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] shadow-card ${isUserMode ? "p-2 sm:p-3" : "p-4"}`}>
      {!isUserMode ? <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black text-primary-strong">양면 레이아웃 빌더</p>
          <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">안전 영역을 참고해 배치해요</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOrientationChange ? (
            <div className="flex rounded-md bg-surface p-1 shadow-soft">
              {(["horizontal", "vertical"] as const).map((orientationId) => (
                <button key={orientationId} className={`rounded-sm px-2 py-1 text-[10px] font-black transition ${orientation === orientationId ? "bg-primary text-white shadow-soft" : "text-primary-strong hover:bg-surface-blue"}`} type="button" onClick={() => onOrientationChange(orientationId)}>
                  {orientationId === "horizontal" ? "가로" : "세로"}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex rounded-md bg-surface p-1 shadow-soft">
            {sideIds.map((sideId) => (
              <button key={sideId} className={`rounded-sm px-2 py-1 text-[10px] font-black transition ${activeSide === sideId ? "bg-primary text-white shadow-soft" : "text-primary-strong hover:bg-surface-blue"}`} type="button" onClick={() => {
                changeActiveSide(sideId);
              }}>
                {sideLabels[sideId]}
              </button>
            ))}
          </div>
        </div>
      </div> : null}

      <SharedCanvasEditorModule elementAdd={elementAddSection} elementAddPlacement={elementAddPlacement} basicIcons={basicIconsSection} editPreview={previewSection} editCanvas={
        <div className={`rounded-lg border border-line bg-surface shadow-soft ${isUserMode ? "overflow-hidden p-0" : "p-4 sm:p-5"}`}>
          <div className={`${isUserMode ? "px-2 pb-3 pt-2 sm:px-3 sm:pt-3" : "mb-3"} flex items-center justify-between gap-3`}>
            <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{sideLabels[activeSide]} · {orientationLabel}</span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <CheckboxPill label="격자 보기" checked={showGrid} onChange={setShowGrid} />
            </div>
          </div>
          {selectedItem && (selectedItem.type !== "logo" || side.logo.visible) ? <QuickControls portal hideLogoVisibility={isUserMode} selectedItem={selectedItem} position={selectedControlsPosition} field={selectedItem.type === "field" ? selectedField : undefined} icon={selectedIcon} line={selectedLine} logo={selectedItem.type === "logo" ? side.logo : undefined} infoBlock={selectedInfoBlock} userQrCodeImageUrl={userQrCodeImageUrl} onUserQrCodeImageChange={onUserQrCodeImageChange} onUserQrCodeImageClear={onUserQrCodeImageClear} onPositionChange={updateSelectedControlsPosition} onFieldChange={(updater) => updateField(selectedFieldId, updater)} onIconChange={(updater) => selectedIcon ? updateIcon(selectedIcon.id, updater) : undefined} onLineChange={(updater) => selectedLine ? updateLine(selectedLine.id, updater) : undefined} onLogoChange={(updater) => updateActiveSide({ ...side, logo: updater(side.logo) })} onInfoBlockChange={(updater) => selectedInfoBlock ? updateInfoBlock(selectedInfoBlock, updater) : undefined} onInfoBlockFieldsChange={(updater) => selectedInfoBlock ? updateInfoBlockFields(selectedInfoBlock, updater) : undefined} onInfoBlockFieldChange={updateInfoBlockField} onInfoBlockIconChange={(updater) => selectedInfoBlock ? updateInfoBlockIcon(selectedInfoBlock, updater) : undefined} /> : null}
          <div className="relative overflow-visible">
          <CanvasEditorZoomFrame contentClassName="pb-4 pr-4">
          <div className={`grid place-items-center rounded-lg ${isUserMode ? "bg-transparent p-0" : "bg-[radial-gradient(circle_at_20%_20%,var(--color-primary-soft)_0%,transparent_28%),linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 sm:p-6 lg:p-8"}`}>
            <div ref={canvasRef} className="relative overflow-visible rounded-md border border-line bg-surface shadow-floating" style={{ ...canvasSizeStyle, aspectRatio: canvasAspect, backgroundColor: activeBackgroundColor || undefined, ...cleanPreviewBackgroundStyle }} onPointerDown={(event) => {
              if (event.currentTarget !== event.target) {
                return;
              }

              if ((event.pointerType === "mouse" && event.button === 0) || event.pointerType === "touch") {
                setSelectedItem(undefined);
              }
            }}>
              {hasActiveBackgroundImage && !hasCleanPreviewImage ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: cssUrl(activeBackgroundImageUrl) }} /> : null}
              {showGrid ? <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(to right, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to right, rgba(7, 93, 203, 0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.34) 1px, transparent 1px)", backgroundSize: "2.5% 2.5%, 2.5% 2.5%, 10% 10%, 10% 10%" }} aria-hidden="true" /> : null}
              <GuideBox box={layout.canvas.edit} label="EDIT" tone="edit" />
              <GuideBox box={layout.canvas.safe} label="SAFE" tone="safe" />
              {!isUserMode ? side.lines.map((line) => (line.visible ? <LinePreview key={line.id} line={line} selected={selectedItem?.type === "line" && selectedItem.lineId === line.id} onPointerDown={(event) => handleLinePointerDown(event, line)} onResizePointerDown={(event, corner) => handleLineResizePointerDown(event, line, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null)) : null}
              {!isUserMode ? contactLayout.blocks.map((block) => <BusinessCardInfoBlockRenderer key={block.id} block={block} cssPixelScale={renderPixelScale} gapScale={canvasScale} trimWidthScale={trimWidthScale} className="pointer-events-none absolute z-10 overflow-visible" />) : null}
              {contactLayout.fields.map((field) => (field.visible ? <TextFieldPreview key={field.id} field={field} displayValue={field.id === "qrCode" ? readFieldValue(field) : displayBusinessCardFieldValue(field.id, readFieldValue(field))} selected={selectedItem?.type === "field" && selectedItem.fieldId === field.id} renderPixelScale={renderPixelScale} trimWidthScale={trimWidthScale} onDoubleClick={() => isUserMode ? undefined : updateFieldText(field)} onPointerDown={(event) => handleTextFieldPointerDown(event, field)} onResizePointerDown={(event, corner) => handleTextFieldResizePointerDown(event, field, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null))}
              {contactLayout.icons.map((icon) => (icon.visible ? <IconPreview key={icon.id} icon={icon} selected={selectedItem?.type === "icon" && selectedItem.iconId === icon.id} cssPixelScale={renderPixelScale} onPointerDown={(event) => handleIconPointerDown(event, icon)} onResizePointerDown={(event, corner) => handleIconResizePointerDown(event, icon, corner)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} /> : null))}
              {!isUserMode ? contactLayout.blocks.map((block) => <InfoBlockMovePreview key={block.id} block={block} selected={selectedItem?.type === "info-block" && selectedItem.blockId === block.id} onPointerDown={(event) => handleInfoBlockPointerDown(event, block)} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag} />) : null}
              {side.logo.visible ? (
                <CanvasEditorSelectableBox className="overflow-hidden bg-transparent" selectedClassName="border-primary shadow-soft ring-2 ring-primary-soft" idleClassName="border-transparent hover:border-primary-soft/60" box={side.logo.box} selected={selectedItem?.type === "logo"} ariaLabel="브랜드 로고" onPointerDown={handleLogoMovePointerDown} onResizePointerDown={handleLogoResizePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopPointerDrag} onPointerCancel={stopPointerDrag}>
                  <span className="absolute" style={{ inset: `${100 / layout.canvas.trim.widthMm}%` }}>
                    {activeLogoUrl ? <img className="h-full w-full object-contain" src={activeLogoUrl} alt="브랜드 로고" draggable={false} /> : <Image className="object-contain" src="/printy_logo.svg" alt="Printy" fill sizes="220px" draggable={false} />}
                  </span>
                </CanvasEditorSelectableBox>
              ) : null}
            </div>
          </div>
          </CanvasEditorZoomFrame>
          </div>
        </div>
      } />

      {!isUserMode ? <div className="mt-4 grid content-start gap-4">
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
                <p className="mt-1 text-xs font-bold leading-5 text-muted">공통 설정에 등록한 배경만 선택해요. 배경색은 요소 추가에서 조정해요.</p>
              </div>
              {side.background.enabled ? <span className="rounded-md bg-primary px-3 py-2 text-xs font-black text-white shadow-soft">사용 중</span> : <span className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong">미사용</span>}
            </div>
            <div className="grid gap-4">
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
        </div> : null}
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

function resolvedLogoUrl(logo: ResolvedLogoOption | undefined, assetType: "png" | "svg" | undefined) {
  return logo && "imageUrl" in logo ? assetType === "svg" && logo.vectorSvgUrl ? logo.vectorSvgUrl : logo.imageUrl : undefined;
}

function readMemberFieldValue(member: Member, field: BusinessCardTemplateTextElement) {
  if (field.id === "qrCode") return member.qrCodeImageUrl?.trim() || field.customValue || sampleFieldValue(field.id);
  if (field.customValue) return field.customValue;
  if (field.id.startsWith("headline-") || field.id.startsWith("body-")) return sampleFieldValue(field.id);

  const value = member[field.id as keyof Pick<Member, "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "instagram">];

  return typeof value === "string" && value.trim() ? value.trim() : sampleFieldValue(field.id);
}

export function BusinessCardUserPreview({ layout, sideId = "front", member, logo, cleanImageUrl, className }: { layout: BusinessCardTemplateLayout; sideId?: BusinessCardTemplateSideId; member: Member; logo?: ResolvedLogoOption; cleanImageUrl?: string; className?: string }) {
  const side = layout.sides[sideId];
  const { cssPixelScale } = getBusinessCardTrimMetrics(layout.canvas.trim);
  const trimWidthScale = businessCardTrimWidthScale(layout.canvas.trim);
  const readFieldValue = (field: BusinessCardTemplateTextElement) => readMemberFieldValue(member, field);
  const contactLayout = resolveBusinessCardContactLayout(side.fields, side.icons, readFieldValue);
  const activeBackgroundImageUrl = readBackgroundImageUrl(side.background);
  const activeBackgroundColor = readBackgroundColor(side.background);
  const cleanPreviewBackgroundStyle: CSSProperties | undefined = cleanImageUrl ? { backgroundImage: cssUrl(cleanImageUrl), backgroundSize: "100% 200%", backgroundPosition: sideId === "front" ? "center top" : "center bottom", backgroundRepeat: "no-repeat" } : undefined;

  return <BusinessCardReadOnlyPreview className={className} layout={layout} sideId={sideId} contactLayout={contactLayout} activeLogoUrl={resolvedLogoUrl(logo, side.logo.assetType)} activeBackgroundColor={activeBackgroundColor} activeBackgroundImageUrl={activeBackgroundImageUrl} cleanPreviewBackgroundStyle={cleanPreviewBackgroundStyle} readFieldValue={readFieldValue} renderPixelScale={cssPixelScale} trimWidthScale={trimWidthScale} />;
}

function BusinessCardReadOnlyPreview({ layout, sideId, contactLayout, activeLogoUrl, activeBackgroundColor, activeBackgroundImageUrl, cleanPreviewBackgroundStyle, readFieldValue, renderPixelScale, trimWidthScale, className }: { layout: BusinessCardTemplateLayout; sideId: BusinessCardTemplateSideId; contactLayout: BusinessCardContactLayout; activeLogoUrl?: string; activeBackgroundColor: string; activeBackgroundImageUrl: string; cleanPreviewBackgroundStyle?: CSSProperties; readFieldValue: (field: BusinessCardTemplateTextElement) => string; renderPixelScale: number; trimWidthScale: number; className?: string }) {
  const side = layout.sides[sideId];
  const canvasAspect = `${layout.canvas.trim.widthMm} / ${layout.canvas.trim.heightMm}`;

  return (
    <CanvasEditorReadOnlyPreviewFrame className={className} aspectRatio={canvasAspect} style={{ backgroundColor: activeBackgroundColor || undefined, ...cleanPreviewBackgroundStyle }}>
        {activeBackgroundImageUrl && !cleanPreviewBackgroundStyle ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: cssUrl(activeBackgroundImageUrl) }} /> : null}
        {contactLayout.fields.map((field) => field.visible ? <ReadOnlyTextFieldPreview key={field.id} field={field} displayValue={field.id === "qrCode" ? readFieldValue(field) : displayBusinessCardFieldValue(field.id, readFieldValue(field))} renderPixelScale={renderPixelScale} trimWidthScale={trimWidthScale} /> : null)}
        {contactLayout.icons.map((icon) => icon.visible ? <ReadOnlyIconPreview key={icon.id} icon={icon} cssPixelScale={renderPixelScale} /> : null)}
        {side.logo.visible ? (
          <div className="absolute overflow-hidden rounded-sm bg-transparent" style={boxStyle(side.logo.box)}>
            <span className="absolute" style={{ inset: `${100 / layout.canvas.trim.widthMm}%` }}>
              {activeLogoUrl ? <img className="h-full w-full object-contain" src={activeLogoUrl} alt="브랜드 로고" draggable={false} /> : <Image className="object-contain" src="/printy_logo.svg" alt="Printy" fill sizes="220px" draggable={false} />}
            </span>
          </div>
        ) : null}
    </CanvasEditorReadOnlyPreviewFrame>
  );
}

function ReadOnlyTextFieldPreview({ field, displayValue, renderPixelScale, trimWidthScale }: { field: BusinessCardTemplateTextElement; displayValue?: string; renderPixelScale: number; trimWidthScale: number }) {
  const value = displayValue ?? displayFieldValue(field);
  const isQrImage = field.id === "qrCode" && isQrCodeImageSource(value);

  return <div className={`absolute overflow-hidden rounded-sm ${fontPreviewClasses[field.fontFamily]}`} style={{ ...boxStyle(field.box), containerType: "size", ...textPreviewStyle(field) }}>{isQrImage ? <img className="h-full w-full object-contain" src={value} alt="QR 코드" draggable={false} /> : <span className="block overflow-hidden whitespace-pre" style={textPreviewContentStyle(field, value)}>{value}</span>}</div>;
}

function ReadOnlyIconPreview({ icon, cssPixelScale }: { icon: BusinessCardTemplateIconElement; cssPixelScale: number }) {
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);

  return <div className="absolute overflow-hidden rounded-sm" style={{ ...boxStyle(icon.box), color: icon.color, padding: `${iconChrome.paddingPx}px` }}>{iconMarkup(icon.icon)}</div>;
}

function textPreviewStyle(field: BusinessCardTemplateTextElement): CSSProperties {
  return {
    ...textColorStyle(field.color),
    fontFamily: fontFamilies[field.fontFamily],
    fontStyle: field.italic ? "italic" : undefined,
    fontWeight: field.fontWeight === "bold" ? 900 : 400,
    lineHeight: designTextLineHeight,
    textAlign: field.align,
  };
}

function textPreviewContentStyle(field: BusinessCardTemplateTextElement, value: string): CSSProperties {
  return {
    ...textColorStyle(field.color),
    fontSize: designTextBoxFontSizeCss(value),
    lineHeight: designTextLineHeight,
  };
}

function TextFieldPreview({ field, displayValue, selected, renderPixelScale, trimWidthScale, onDoubleClick, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { field: BusinessCardTemplateTextElement; displayValue?: string; selected: boolean; renderPixelScale: number; trimWidthScale: number; onDoubleClick: () => void; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  const value = displayValue ?? displayFieldValue(field);
  const isQrImage = field.id === "qrCode" && isQrCodeImageSource(value);

  return (
    <CanvasEditorSelectableOverlayBox label={field.id} className={`overflow-hidden ${fontPreviewClasses[field.fontFamily]}`} selectedClassName="border-primary bg-surface/20 shadow-soft ring-2 ring-primary-soft" idleClassName="border-transparent bg-transparent hover:border-primary-soft/50" box={field.box} selected={selected} style={{ containerType: "size", ...textPreviewStyle(field) }} onPointerDown={onPointerDown} onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {isQrImage ? <img className="pointer-events-none h-full w-full object-contain" src={value} alt="QR 코드" draggable={false} /> : <span className="block overflow-hidden whitespace-pre" style={textPreviewContentStyle(field, value)}>{value}</span>}
    </CanvasEditorSelectableOverlayBox>
  );
}

function InfoBlockMovePreview({ block, selected, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: { block: BusinessCardInfoBlock; selected: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <CanvasEditorSelectableOverlayBox label={businessCardInfoBlockLabels[block.id] ?? "정보 영역"} className="z-20" selectedClassName="border-primary bg-primary-soft/15 shadow-soft ring-2 ring-primary-soft" idleClassName="border-transparent bg-transparent hover:border-primary-soft/80 hover:bg-primary-soft/10" box={block.box} selected={selected} resizeHandles={false} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {selected ? <span className="absolute -top-6 left-0 rounded-sm bg-primary px-2 py-1 text-[9px] font-black text-white shadow-soft">{businessCardInfoBlockLabels[block.id] ?? "정보 영역"}</span> : null}
    </CanvasEditorSelectableOverlayBox>
  );
}

function LinePreview({ line, selected, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { line: BusinessCardTemplateLineElement; selected: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  return <CanvasEditorSelectableOverlayBox label="라인" className="" selectedClassName="border-primary shadow-soft ring-2 ring-primary-soft" idleClassName="border-transparent hover:border-primary-soft/50" box={line.box} selected={selected} style={{ backgroundColor: line.color }} onPointerDown={onPointerDown} onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />;
}

function IconPreview({ icon, selected, cssPixelScale, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { icon: BusinessCardTemplateIconElement; selected: boolean; cssPixelScale: number; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void; onPointerMove: (event: PointerEvent<HTMLElement>) => void; onPointerUp: (event: PointerEvent<HTMLElement>) => void; onPointerCancel: (event: PointerEvent<HTMLElement>) => void }) {
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);

  return (
    <CanvasEditorSelectableOverlayBox label="아이콘" className="overflow-hidden" selectedClassName="border-primary bg-surface/20 shadow-soft ring-2 ring-primary-soft" idleClassName="border-transparent bg-transparent hover:border-primary-soft/50" box={icon.box} selected={selected} style={{ borderStyle: "solid", borderWidth: `${iconChrome.borderWidthPx}px`, color: icon.color, padding: `${iconChrome.paddingPx}px` }} onPointerDown={onPointerDown} onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {iconMarkup(icon.icon)}
    </CanvasEditorSelectableOverlayBox>
  );
}

function readIconId(value: string): BusinessCardTemplateIconId {
  return businessCardTemplateIconIds.find((iconId) => iconId === value) ?? "phone";
}
