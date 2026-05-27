"use client";

import { type CSSProperties, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { CanvasEditorSelectableOverlayBox } from "@/components/design-production/canvas-editor-control-primitives";
import { canvasEditorKeyboardMoveDelta, isCanvasEditorCopyShortcut, isCanvasEditorDeleteShortcut, isCanvasEditorFormTarget, isCanvasEditorUndoShortcut, useCanvasEditorFloatingPanelDrag, useCanvasEditorHistory, useCanvasEditorPointerDrag, type CanvasEditorPointerDragBase } from "@/components/design-production/canvas-editor-interactions";
import { CanvasEditorElementPanel, CanvasEditorZoomFrame, SharedCanvasEditorModule, canvasEditorBackgroundGridActions, canvasEditorBasicIconActions, canvasEditorCoreElementActions, canvasEditorMappedElementActions, type CanvasEditorBasicIconOption, type CanvasEditorResizeCorner, type CanvasElementPanelPlacement } from "@/components/design-production/canvas-editor-panels";
import { FieldControls, LogoControls, PromptShapeControls } from "@/components/printy/print-products/print-product-editor-controls";
import { PrintProductPreviewOverlay } from "@/components/printy/print-products/print-product-preview-overlay";
import { canvasBoxesIntersect, canvasBoxStyle, moveCanvasBox, readCanvasSelectionBox, resizeCanvasBox, resizeCanvasTextBoxToContent, roundCanvasPercent, snapCanvasPercent, updateCanvasBoxValue } from "@/lib/design-projects";
import { readQrImageFile } from "@/lib/member-qr-image";
import type { PrintProductProductionBox, PrintProductProductionField, PrintProductProductionLayout, PrintProductPromptShape } from "@/lib/types";

type SelectedTarget = { type: "field"; id: PrintProductProductionField["id"] } | { type: "logo" } | { type: "promptShape"; id: string };
type ResizeCorner = CanvasEditorResizeCorner;
type SelectionBox = { x: number; y: number; width: number; height: number };
type DragTarget = CanvasEditorPointerDragBase & (
  | { action: "move"; target: SelectedTarget; startBox: PrintProductProductionBox }
  | { action: "resize"; target: SelectedTarget; corner: ResizeCorner; startBox: PrintProductProductionBox }
  | { action: "group-move"; targets: SelectedTarget[]; startBoxes: Array<{ target: SelectedTarget; box: PrintProductProductionBox }> }
  | { action: "select"; currentX: number; currentY: number }
);

type PrintProductEditorProps = {
  layout: PrintProductProductionLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  onChange: (layout: PrintProductProductionLayout) => void;
};

const gridStep = 2.5;
function roundPercent(value: number) {
  return roundCanvasPercent(value);
}

function snapPercent(value: number) {
  return snapCanvasPercent(value, gridStep);
}

function boxStyle(box: PrintProductProductionBox): CSSProperties {
  return canvasBoxStyle(box);
}

function moveBox(box: PrintProductProductionBox, deltaX: number, deltaY: number, snapToGrid: boolean): PrintProductProductionBox {
  return moveCanvasBox(box, deltaX, deltaY, { snapGridStep: snapToGrid ? gridStep : undefined, minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function resizeBox(box: PrintProductProductionBox, corner: ResizeCorner, deltaX: number, deltaY: number, snapToGrid: boolean): PrintProductProductionBox {
  return resizeCanvasBox(box, corner, deltaX, deltaY, { minWidth: 10, maxWidth: 100, minHeight: 3, maxHeight: 100, snapGridStep: snapToGrid ? gridStep : undefined });
}

function resizeTextBoxToContent(box: PrintProductProductionBox, corner: ResizeCorner, deltaX: number, deltaY: number, snapToGrid: boolean, layout: PrintProductProductionLayout, value: string): PrintProductProductionBox {
  return resizeCanvasTextBoxToContent(box, corner, deltaX, deltaY, { pageWidthMm: layout.widthMm, pageHeightMm: layout.heightMm, value, minWidth: 10, maxWidth: 100, minHeight: 3, maxHeight: 100, snapGridStep: snapToGrid ? gridStep : undefined });
}

function textTargetField(target: SelectedTarget, layout: PrintProductProductionLayout) {
  if (target.type !== "field") return false;
  const field = layout.fields.find((item) => item.id === target.id);

  return field && field.id !== "qrCode" ? field : undefined;
}

function updateBoxValue(box: PrintProductProductionBox, key: keyof PrintProductProductionBox, value: number): PrintProductProductionBox {
  return updateCanvasBoxValue(box, key, value, { minWidth: 10, maxWidth: 100, minHeight: 3, maxHeight: 100, minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function isHeadlineField(field: PrintProductProductionField) {
  return field.id === "headline" || field.id.startsWith("headline-");
}

function isBodyField(field: PrintProductProductionField) {
  return field.id === "body" || field.id.startsWith("body-");
}

function nextFieldNumber(fields: PrintProductProductionField[], kind: "headline" | "body") {
  return fields.filter((field) => kind === "headline" ? isHeadlineField(field) : isBodyField(field)).length + 1;
}

function defaultAddedFieldFontSize(kind: "headline" | "body", widthMm: number) {
  return kind === "headline" ? Math.min(Math.max(13, widthMm * 0.07), 120) : Math.min(Math.max(5.5, widthMm * 0.025), 60);
}

function makeAddedField(kind: "headline" | "body", fields: PrintProductProductionField[], widthMm: number): PrintProductProductionField {
  const count = nextFieldNumber(fields, kind);
  const isHeadline = kind === "headline";

  return {
    id: `${kind}-${count}`,
    label: `${isHeadline ? "문구" : "상세 안내"} ${count}`,
    value: "",
    visible: true,
    box: isHeadline ? { x: 12, y: 18 + count * 8, width: 76, height: 12 } : { x: 18, y: 42 + count * 8, width: 64, height: 14 },
    fontFamily: "sans",
    fontSize: defaultAddedFieldFontSize(kind, widthMm),
    color: "#111827",
    fontWeight: isHeadline ? "bold" : "regular",
    italic: false,
    align: "center",
  };
}

function copyAddedField(field: PrintProductProductionField, fields: PrintProductProductionField[]): PrintProductProductionField | undefined {
  const kind = isHeadlineField(field) ? "headline" : isBodyField(field) ? "body" : undefined;
  if (!kind) return undefined;

  const count = nextFieldNumber(fields, kind);
  const nextBox = moveBox(field.box, 2.5, 2.5, false);

  return { ...field, id: `${kind}-${count}`, label: `${kind === "headline" ? "문구" : "상세 안내"} ${count}`, visible: true, box: nextBox };
}

function makePromptShape(option?: CanvasEditorBasicIconOption): PrintProductPromptShape {
  return { id: `prompt-shape-${Date.now()}`, label: option?.label ?? "기본 아이콘", prompt: "", visible: true, box: { x: 43, y: 32, width: 14, height: 14 }, fillColor: "#ffffff", strokeColor: "#111827", textColor: "#111827", glyph: option?.glyph ?? "AI" };
}

function makeQrField(fields: PrintProductProductionField[]): PrintProductProductionField {
  return { id: "qrCode", label: "QR 코드", value: fields.find((field) => field.id === "qrCode")?.value ?? "", visible: true, box: { x: 82, y: 72, width: 10, height: 10 }, fontFamily: "sans", fontSize: 4.5, color: "#111827", fontWeight: "regular", italic: false, align: "center" };
}

function targetKey(target: SelectedTarget) {
  return target.type === "logo" ? "logo" : `${target.type}:${target.id}`;
}

function boxesIntersect(left: PrintProductProductionBox, right: PrintProductProductionBox) {
  return canvasBoxesIntersect(left, right);
}

function elementAddPlacementForProduct(): CanvasElementPanelPlacement {
  return "bottom";
}

function readSelectionBox(drag: Extract<DragTarget, { action: "select" }>, bounds: DOMRect): SelectionBox {
  return readCanvasSelectionBox({ startX: drag.startClientX, startY: drag.startClientY, currentX: drag.currentX, currentY: drag.currentY }, bounds);
}

export function PrintProductEditor({ layout, backgroundImageUrl, logoImageUrl, logoVectorSvgUrl, onChange }: PrintProductEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const history = useCanvasEditorHistory({ value: layout, onChange });
  const dragController = useCanvasEditorPointerDrag<DragTarget>();
  const drag = dragController.dragState;
  const touchTapRef = useRef<{ key: string; time: number } | undefined>(undefined);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>();
  const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);
  const [panelPosition, setPanelPosition] = useState({ x: 12, y: 12 });
  const panelDrag = useCanvasEditorFloatingPanelDrag({ position: panelPosition, onPositionChange: setPanelPosition, relativeRef: canvasRef, minX: -80, maxX: 140, minY: -80, maxY: 140 });
  const [showGrid, setShowGrid] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [qrError, setQrError] = useState("");
  const [promptError, setPromptError] = useState("");
  const [isPrompting, setIsPrompting] = useState(false);
  const selectedField = selectedTarget?.type === "field" ? layout.fields.find((field) => field.id === selectedTarget.id) : undefined;
  const selectedPromptShape = selectedTarget?.type === "promptShape" ? (layout.promptShapes ?? []).find((shape) => shape.id === selectedTarget.id) : undefined;
  const selectedKeys = useMemo(() => new Set(selectedTargets.map(targetKey)), [selectedTargets]);
  const selectionBox = drag?.action === "select" && canvasRef.current ? readSelectionBox(drag, canvasRef.current.getBoundingClientRect()) : undefined;
  const canvasWidthPx = layout.widthMm >= layout.heightMm ? 420 : 220;
  const canvasHeightPx = canvasWidthPx * (layout.heightMm / layout.widthMm);
  const canvasFrameStyle: CSSProperties = { width: `${canvasWidthPx}px`, maxWidth: "100%", aspectRatio: `${layout.widthMm} / ${layout.heightMm}` };

  const commitLayout = (nextLayout: PrintProductProductionLayout, recordHistory = true) => {
    history.updateWithHistory(nextLayout, recordHistory);
  };
  const updateField = (fieldId: PrintProductProductionField["id"], patch: Partial<PrintProductProductionField>, recordHistory = true) => {
    commitLayout({ ...layout, fields: layout.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)) }, recordHistory);
  };
  const updatePromptShape = (shapeId: string, patch: Partial<PrintProductPromptShape>, recordHistory = true) => {
    commitLayout({ ...layout, promptShapes: (layout.promptShapes ?? []).map((shape) => (shape.id === shapeId ? { ...shape, ...patch } : shape)) }, recordHistory);
  };
  const updateFieldBox = (fieldId: PrintProductProductionField["id"], box: PrintProductProductionBox, recordHistory = true) => updateField(fieldId, { box }, recordHistory);
  const updateLogoBox = (box: PrintProductProductionBox, recordHistory = true) => commitLayout({ ...layout, logo: { ...layout.logo, box } }, recordHistory);
  const updatePromptShapeBox = (shapeId: string, box: PrintProductProductionBox, recordHistory = true) => updatePromptShape(shapeId, { box }, recordHistory);
  const updateSelectedBox = (box: PrintProductProductionBox) => selectedTarget?.type === "logo" ? updateLogoBox(box) : selectedTarget?.type === "field" ? updateFieldBox(selectedTarget.id, box) : selectedTarget?.type === "promptShape" ? updatePromptShapeBox(selectedTarget.id, box) : undefined;

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragDelta = dragController.readPointerDragDelta(event);

    if (!dragDelta) return;

    const { dragState: drag, deltaX, deltaY } = dragDelta;
    if (drag.action === "select") {
      dragController.setDragState({ ...drag, currentX: event.clientX, currentY: event.clientY });
      return;
    }
    if (drag.action === "group-move") {
      const nextFields = layout.fields.map((field) => {
        const match = drag.startBoxes.find((item) => item.target.type === "field" && item.target.id === field.id);
        return match ? { ...field, box: moveBox(match.box, deltaX, deltaY, showGrid) } : field;
      });
      const nextPromptShapes = (layout.promptShapes ?? []).map((shape) => {
        const match = drag.startBoxes.find((item) => item.target.type === "promptShape" && item.target.id === shape.id);
        return match ? { ...shape, box: moveBox(match.box, deltaX, deltaY, showGrid) } : shape;
      });
      const logoMatch = drag.startBoxes.find((item) => item.target.type === "logo");
      commitLayout({ ...layout, fields: nextFields, promptShapes: nextPromptShapes, logo: logoMatch ? { ...layout.logo, box: moveBox(logoMatch.box, deltaX, deltaY, showGrid) } : layout.logo }, false);
      return;
    }
    const textField = drag.action === "resize" ? textTargetField(drag.target, layout) : undefined;
    const nextBox = drag.action === "move"
      ? moveBox(drag.startBox, deltaX, deltaY, showGrid)
      : textField
        ? resizeTextBoxToContent(drag.startBox, drag.corner, deltaX, deltaY, showGrid, layout, textField.value)
        : resizeBox(drag.startBox, drag.corner, deltaX, deltaY, showGrid);
    if (drag.target.type === "logo") {
      updateLogoBox(nextBox, false);
    } else if (drag.target.type === "promptShape") {
      updatePromptShapeBox(drag.target.id, nextBox, false);
    } else {
      updateFieldBox(drag.target.id, nextBox, false);
    }
  };

  const targetBox = (target: SelectedTarget) => target.type === "logo" ? layout.logo.box : target.type === "field" ? layout.fields.find((field) => field.id === target.id)?.box : (layout.promptShapes ?? []).find((shape) => shape.id === target.id)?.box;

  const isDoubleTouchTap = (event: PointerEvent<HTMLElement>, target: SelectedTarget) => {
    if (event.pointerType !== "touch") return false;

    const key = targetKey(target);
    const now = window.performance.now();
    const previousTap = touchTapRef.current;
    touchTapRef.current = { key, time: now };
    return Boolean(previousTap && previousTap.key === key && now - previousTap.time < 320);
  };

  const startDrag = (event: PointerEvent<HTMLElement>, target: SelectedTarget, action: "move", box: PrintProductProductionBox) => {
    const doubleTouchTap = isDoubleTouchTap(event, target);

    if (doubleTouchTap) {
      event.preventDefault();
      event.stopPropagation();
      setSelectedTarget(target);
      setSelectedTargets([target]);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType !== "touch") {
      setSelectedTarget(target);
    }
    const groupTargets = selectedKeys.has(targetKey(target)) && selectedTargets.length > 1 ? selectedTargets : [];
    history.recordHistory(layout);
    if (groupTargets.length > 1) {
      dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, action: "group-move", targets: groupTargets, startBoxes: groupTargets.map((item) => ({ target: item, box: targetBox(item) })).filter((item): item is { target: SelectedTarget; box: PrintProductProductionBox } => Boolean(item.box)) }));
      return;
    }
    if (event.pointerType !== "touch") {
      setSelectedTargets([target]);
    }
    dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, action, target, startBox: box }));
  };

  const startResize = (event: PointerEvent<HTMLSpanElement>, target: SelectedTarget, corner: ResizeCorner, box: PrintProductProductionBox) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTarget(target);
    setSelectedTargets([target]);
    history.recordHistory(layout);
    dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, action: "resize", target, corner, startBox: box }));
  };

  const finishPointerAction = (event: PointerEvent<HTMLDivElement>) => {
    const activeDrag = drag;

    if (activeDrag?.action === "select" && canvasRef.current) {
      const box = readSelectionBox(activeDrag, canvasRef.current.getBoundingClientRect());
      const targets: SelectedTarget[] = [layout.logo.visible ? { type: "logo" as const } : undefined, ...layout.fields.filter((field) => field.visible && boxesIntersect(field.box, box)).map((field) => ({ type: "field" as const, id: field.id })), ...(layout.promptShapes ?? []).filter((shape) => shape.visible && boxesIntersect(shape.box, box)).map((shape) => ({ type: "promptShape" as const, id: shape.id }))].filter((target): target is SelectedTarget => Boolean(target && (target.type !== "logo" || boxesIntersect(layout.logo.box, box))));
      setSelectedTargets(targets);
      setSelectedTarget(targets[0]);
    }
    dragController.finishPointerDrag(event);
  };

  const updateQrImage = async (file: File | undefined) => {
    if (!file || !selectedField || selectedField.id !== "qrCode") return;
    try {
      updateField(selectedField.id, { value: await readQrImageFile(file), visible: true });
      setQrError("");
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "QR 이미지를 읽지 못했어요.");
    }
  };

  const deleteSelectedTarget = () => {
    const targets = selectedTargets.length > 0 ? selectedTargets : selectedTarget ? [selectedTarget] : [];

    if (targets.length === 0) return;

    const targetKeys = new Set(targets.map(targetKey));
    const nextFields = layout.fields.flatMap((field) => {
      if (!targetKeys.has(`field:${field.id}`)) return [field];

      return field.id.startsWith("headline-") || field.id.startsWith("body-") ? [] : [{ ...field, visible: false }];
    });
    const nextPromptShapes = (layout.promptShapes ?? []).filter((shape) => !targetKeys.has(`promptShape:${shape.id}`));
    const nextLogo = targetKeys.has("logo") ? { ...layout.logo, visible: false } : layout.logo;

    commitLayout({ ...layout, fields: nextFields, promptShapes: nextPromptShapes, logo: nextLogo });
    setSelectedTarget(undefined);
    setSelectedTargets([]);
  };

  const copySelectedTextField = () => {
    if (selectedTarget?.type !== "field") return false;
    const field = layout.fields.find((item) => item.id === selectedTarget.id);
    const copiedField = field ? copyAddedField(field, layout.fields) : undefined;

    if (!copiedField) return false;

    commitLayout({ ...layout, fields: [...layout.fields, copiedField] });
    setSelectedTarget({ type: "field", id: copiedField.id });
    setSelectedTargets([{ type: "field", id: copiedField.id }]);
    return true;
  };

  const moveSelectedTargetsByKeyboard = (deltaX: number, deltaY: number) => {
    const targets = selectedTargets.length > 0 ? selectedTargets : selectedTarget ? [selectedTarget] : [];

    if (targets.length === 0) return false;

    const targetKeys = new Set(targets.map(targetKey));
    const nextFields = layout.fields.map((field) => targetKeys.has(`field:${field.id}`) ? { ...field, box: moveBox(field.box, deltaX, deltaY, false) } : field);
    const nextPromptShapes = (layout.promptShapes ?? []).map((shape) => targetKeys.has(`promptShape:${shape.id}`) ? { ...shape, box: moveBox(shape.box, deltaX, deltaY, false) } : shape);
    const nextLogo = targetKeys.has("logo") ? { ...layout.logo, box: moveBox(layout.logo.box, deltaX, deltaY, false) } : layout.logo;

    commitLayout({ ...layout, fields: nextFields, promptShapes: nextPromptShapes, logo: nextLogo });
    return true;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (isCanvasEditorUndoShortcut(event)) {
        if (history.undo()) {
          event.preventDefault();
        }
        return;
      }
      if (isCanvasEditorFormTarget(target)) return;
      if (isCanvasEditorCopyShortcut(event)) {
        if (copySelectedTextField()) {
          event.preventDefault();
        }
        return;
      }
      if (isCanvasEditorDeleteShortcut(event)) {
        if (selectedTarget || selectedTargets.length > 0) {
          event.preventDefault();
          deleteSelectedTarget();
        }
      }
      const keyboardMove = canvasEditorKeyboardMoveDelta(event);
      if (keyboardMove && moveSelectedTargetsByKeyboard(keyboardMove.x, keyboardMove.y)) event.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [layout, onChange, selectedTarget, selectedTargets]);

  const addField = (kind: "headline" | "body") => {
    const field = makeAddedField(kind, layout.fields, layout.widthMm);

    onChange({ ...layout, fields: [...layout.fields, field] });
    setSelectedTarget({ type: "field", id: field.id });
    setSelectedTargets([{ type: "field", id: field.id }]);
  };

  const addQrField = () => {
    const existing = layout.fields.find((field) => field.id === "qrCode");
    const nextField = existing ?? makeQrField(layout.fields);
    const nextFields = existing ? layout.fields.map((field) => field.id === "qrCode" ? { ...field, visible: true } : field) : [...layout.fields, nextField];
    commitLayout({ ...layout, fields: nextFields });
    setSelectedTarget({ type: "field", id: "qrCode" });
    setSelectedTargets([{ type: "field", id: "qrCode" }]);
  };

  const addPromptShape = (option?: CanvasEditorBasicIconOption) => {
    const shape = makePromptShape(option);

    onChange({ ...layout, promptShapes: [...(layout.promptShapes ?? []), shape] });
    setSelectedTarget({ type: "promptShape", id: shape.id });
    setSelectedTargets([{ type: "promptShape", id: shape.id }]);
    setPromptError("");
  };

  const requestPromptShape = async (shape: PrintProductPromptShape) => {
    if (!shape.prompt.trim()) {
      setPromptError("프롬프트를 입력해 주세요.");
      return;
    }

    setIsPrompting(true);
    setPromptError("");
    try {
      const response = await fetch("/api/print-products/prompt-shapes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: shape.prompt }) });
      const payload: unknown = await response.json().catch(() => undefined);
      const suggestion = typeof payload === "object" && payload !== null && "suggestion" in payload && typeof payload.suggestion === "object" && payload.suggestion !== null ? payload.suggestion as Partial<PrintProductPromptShape> : undefined;

      if (!response.ok && !suggestion) {
        const reason = typeof payload === "object" && payload !== null && "reason" in payload && typeof payload.reason === "string" ? payload.reason : "GPT 요청에 실패했어요.";
        throw new Error(reason);
      }

      if (suggestion) {
        updatePromptShape(shape.id, { label: suggestion.label ?? shape.label, glyph: suggestion.glyph ?? shape.glyph, fillColor: suggestion.fillColor ?? shape.fillColor, strokeColor: suggestion.strokeColor ?? shape.strokeColor, textColor: suggestion.textColor ?? shape.textColor });
      }
    } catch (error) {
      setPromptError(error instanceof Error ? error.message : "GPT 요청에 실패했어요.");
    } finally {
      setIsPrompting(false);
    }
  };

  const startCanvasSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && event.currentTarget === event.target) {
      setSelectedTarget(undefined);
      setSelectedTargets([]);
      return;
    }

    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (dragController.startPointerDrag(event, canvasRef, (base) => ({ ...base, action: "select", currentX: event.clientX, currentY: event.clientY }))) {
      setSelectedTarget(undefined);
      setSelectedTargets([]);
    }
  };

  const elementActions = [
    ...canvasEditorBackgroundGridActions({ backgroundColor: layout.backgroundColor, showGrid, onBackgroundColorChange: (backgroundColor) => commitLayout({ ...layout, backgroundColor }), onShowGridChange: setShowGrid }),
    ...canvasEditorCoreElementActions({ logoActive: selectedTarget?.type === "logo", onLogoAdd: () => setSelectedTarget({ type: "logo" }), onHeadlineAdd: () => addField("headline"), onBodyAdd: () => addField("body") }),
    { id: "qrCode", label: "QR 코드 추가", active: selectedTarget?.type === "field" && selectedTarget.id === "qrCode", onClick: addQrField },
    ...canvasEditorMappedElementActions(layout.fields, (field) => ({ id: `field-${field.id}`, label: field.label, active: selectedTarget?.type === "field" && selectedTarget.id === field.id, onClick: () => setSelectedTarget({ type: "field" as const, id: field.id }) })),
    ...canvasEditorMappedElementActions(layout.promptShapes ?? [], (shape) => ({ id: `promptShape-${shape.id}`, label: shape.label, active: selectedTarget?.type === "promptShape" && selectedTarget.id === shape.id, onClick: () => setSelectedTarget({ type: "promptShape" as const, id: shape.id }) })),
  ];
  const basicIconActions = canvasEditorBasicIconActions((option) => ({ onClick: () => addPromptShape(option) }));
  const elementAddPlacement = elementAddPlacementForProduct();
  const editCanvas = (
    <div className="relative overflow-visible">
      <CanvasEditorZoomFrame className="min-h-0" contentClassName="pb-4 pr-4" onZoomChange={setCanvasZoom}>
      <div ref={canvasRef} className="relative mx-auto overflow-visible rounded-lg" style={canvasFrameStyle} onPointerDown={startCanvasSelection} onPointerMove={handlePointerMove} onPointerUp={finishPointerAction} onPointerCancel={finishPointerAction}>
        <PrintProductPreviewOverlay className="h-full" layout={layout} backgroundImageUrl={backgroundImageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />
        {showGrid ? <div className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(to right, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.22) 1px, transparent 1px), linear-gradient(to right, rgba(7, 93, 203, 0.34) 1px, transparent 1px), linear-gradient(to bottom, rgba(7, 93, 203, 0.34) 1px, transparent 1px)", backgroundSize: "20px 20px, 20px 20px, 80px 80px, 80px 80px" }} aria-hidden="true" /> : null}
        {layout.logo.visible ? <EditableBox label="로고" selected={selectedTarget?.type === "logo" || selectedKeys.has("logo")} box={layout.logo.box} onPointerDown={(event) => startDrag(event, { type: "logo" }, "move", layout.logo.box)} onResizePointerDown={(event, corner) => startResize(event, { type: "logo" }, corner, layout.logo.box)} /> : null}
        {(layout.promptShapes ?? []).map((shape) => shape.visible ? <EditableBox key={shape.id} label={shape.label} selected={(selectedTarget?.type === "promptShape" && selectedTarget.id === shape.id) || selectedKeys.has(`promptShape:${shape.id}`)} box={shape.box} onPointerDown={(event) => startDrag(event, { type: "promptShape", id: shape.id }, "move", shape.box)} onResizePointerDown={(event, corner) => startResize(event, { type: "promptShape", id: shape.id }, corner, shape.box)} /> : null)}
        {layout.fields.map((field) => field.visible ? <EditableBox key={field.id} label={field.label} selected={(selectedTarget?.type === "field" && selectedTarget.id === field.id) || selectedKeys.has(`field:${field.id}`)} box={field.box} onPointerDown={(event) => startDrag(event, { type: "field", id: field.id }, "move", field.box)} onResizePointerDown={(event, corner) => startResize(event, { type: "field", id: field.id }, corner, field.box)} /> : null)}
        {selectionBox ? <div className="pointer-events-none absolute z-20 border border-primary bg-primary/10" style={boxStyle(selectionBox)} /> : null}
      </div>
      </CanvasEditorZoomFrame>
      {selectedTarget ? <div className="absolute z-[2147483647] w-[22rem] max-w-[min(22rem,calc(100vw-1rem))] cursor-move" style={{ left: `${panelPosition.x}%`, top: `${panelPosition.y}%` }} onPointerDown={panelDrag.startPanelDrag} onPointerMove={panelDrag.movePanelDrag} onPointerUp={panelDrag.stopPanelDrag} onPointerCancel={panelDrag.stopPanelDrag}>
        {selectedTarget.type === "logo" ? <LogoControls layout={layout} logoVectorSvgUrl={logoVectorSvgUrl} onChange={commitLayout} onLogoBoxChange={(key, value) => updateLogoBox(updateBoxValue(layout.logo.box, key, value))} /> : null}
        {selectedField ? <FieldControls field={selectedField} qrError={qrError} onFieldChange={(patch) => updateField(selectedField.id, patch)} onFieldBoxChange={(key, value) => updateSelectedBox(updateBoxValue(selectedField.box, key, value))} onQrImageChange={updateQrImage} onQrImageClear={() => updateField(selectedField.id, { value: "" })} /> : null}
        {selectedPromptShape ? <PromptShapeControls shape={selectedPromptShape} error={promptError} isPrompting={isPrompting} onChange={(patch) => updatePromptShape(selectedPromptShape.id, patch)} onBoxChange={(key, value) => updateSelectedBox(updateBoxValue(selectedPromptShape.box, key, value))} onRequest={() => requestPromptShape(selectedPromptShape)} /> : null}
      </div> : null}
    </div>
  );

  return (
    <SharedCanvasEditorModule
      elementAdd={<CanvasEditorElementPanel placement={elementAddPlacement} actions={elementActions} />}
      elementAddPlacement={elementAddPlacement}
      editCanvas={editCanvas}
      basicIcons={<CanvasEditorElementPanel title="기본 아이콘" placement="bottom" actions={basicIconActions} collapsible defaultCollapsed />}
      editPreview={<div className="phone-scroll overflow-auto"><div className="mx-auto" style={{ width: `${canvasWidthPx * canvasZoom}px`, height: `${canvasHeightPx * canvasZoom}px`, maxWidth: "none" }}><div style={{ ...canvasFrameStyle, maxWidth: "none", transform: `scale(${canvasZoom})`, transformOrigin: "top left" }}><PrintProductPreviewOverlay className="h-full" layout={layout} backgroundImageUrl={backgroundImageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} /></div></div></div>}
    />
  );
}

function EditableBox({ label, selected, box, onPointerDown, onResizePointerDown }: { label: string; selected: boolean; box: PrintProductProductionBox; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: ResizeCorner) => void }) {
  return <CanvasEditorSelectableOverlayBox label={label} box={box} selected={selected} onPointerDown={onPointerDown} onResizePointerDown={onResizePointerDown} />;
}
