import { type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { CanvasEditorBoxNumberControls, CanvasEditorSelectableBox, type CanvasEditorResizeCorner } from "@/components/design-production/canvas-editor-panels";
import { QrCodeImageField } from "@/components/printy/member-qr-code-image-field";
import { businessCardTemplateFontFamilies } from "@/lib/business-card-templates";
import { clampCanvasValue, roundCanvasPercent } from "@/lib/design-projects";
import type { DesignBox } from "@/lib/design-projects/types";
import type { BusinessCardTemplateFontFamily } from "@/lib/types";

export const canvasEditorFontLabels: Record<BusinessCardTemplateFontFamily, string> = {
  sans: "고딕",
  serif: "명조",
  rounded: "둥근",
  mono: "고정폭",
  display: "부드러운",
  handwriting: "손글씨",
};

export const canvasEditorTextAlignLabels = { left: "좌측", center: "중앙", right: "우측" } as const;

export type CanvasEditorTextControlModel = {
  id: string;
  title: string;
  value: string;
  visible: boolean;
  multiline: boolean;
  fontFamily: BusinessCardTemplateFontFamily;
  color: string;
  fontWeight: "regular" | "bold";
  italic: boolean;
  align: "left" | "center" | "right";
};

export function readCanvasEditorFontFamily(value: string): BusinessCardTemplateFontFamily {
  return businessCardTemplateFontFamilies.find((fontFamily) => fontFamily === value) ?? "sans";
}

export function CanvasEditorQrImageControl({ value, onChange, onClear }: { value: string; onChange: (file: File | undefined) => void; onClear: () => void }) {
  return <QrCodeImageField value={value} onChange={onChange} onClear={onClear} />;
}

export function CanvasEditorCompactBoxNumberControls({ box, className = "grid grid-cols-4 gap-1", minSize = 1, onChange }: { box: DesignBox; className?: string; minSize?: number; onChange: (key: keyof DesignBox, value: number) => void }) {
  return (
    <CanvasEditorBoxNumberControls box={box} minSize={minSize} className={className} step={0.01} emptyValue={0} inputClassName="h-8 w-full min-w-0 rounded-sm border border-line bg-surface px-1.5 text-xs font-black text-ink outline-none focus:border-primary" normalizeValue={(nextValue, inputMin, inputMax) => roundCanvasPercent(clampCanvasValue(nextValue, inputMin, inputMax))} onChange={onChange} />
  );
}

export function CanvasEditorRoundedBoxNumberControls({ box, minSize = 3, onChange }: { box: DesignBox; minSize?: number; onChange: (key: keyof DesignBox, value: number) => void }) {
  return (
    <CanvasEditorBoxNumberControls box={box} minSize={minSize} displayValue={(value, step) => step < 1 ? String(Math.round(value * 10) / 10) : String(Math.round(value))} normalizeValue={(nextValue, inputMin, inputMax, inputStep) => {
      const clampedValue = clampCanvasValue(nextValue, inputMin, inputMax);

      return inputStep < 1 ? Math.round(clampedValue * 10) / 10 : Math.round(clampedValue);
    }} onChange={onChange} />
  );
}

export function CanvasEditorSelectableOverlayBox({ label, selected, box, children, className = "z-10", selectedClassName, idleClassName, style, resizeHandles, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: { label: string; selected: boolean; box: DesignBox; children?: ReactNode; className?: string; selectedClassName?: string; idleClassName?: string; style?: CSSProperties; resizeHandles?: boolean; onPointerDown: (event: PointerEvent<HTMLDivElement>) => void; onResizePointerDown?: (event: PointerEvent<HTMLSpanElement>, corner: CanvasEditorResizeCorner) => void; onPointerMove?: (event: PointerEvent<HTMLElement>) => void; onPointerUp?: (event: PointerEvent<HTMLElement>) => void; onPointerCancel?: (event: PointerEvent<HTMLElement>) => void }) {
  return <CanvasEditorSelectableBox className={className} selectedClassName={selectedClassName} idleClassName={idleClassName} style={style} resizeHandles={resizeHandles} box={box} selected={selected} ariaLabel={`${label} 위치 이동`} onPointerDown={onPointerDown} onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>{children}</CanvasEditorSelectableBox>;
}

export function CanvasEditorReadOnlyPreviewFrame({ aspectRatio, className = "", frameClassName = "", style, children }: { aspectRatio: string; className?: string; frameClassName?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={`grid place-items-center overflow-auto rounded-lg bg-surface-blue p-3 ${className}`}>
      <div className={`relative w-full overflow-hidden rounded-md border border-line bg-surface shadow-soft ${frameClassName}`} style={{ aspectRatio, ...style }}>
        {children}
      </div>
    </div>
  );
}
