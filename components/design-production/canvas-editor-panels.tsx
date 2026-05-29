"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { canvasBoxStyle } from "@/lib/design-projects";
import { textColorInputValue, textGradientOptions, textSolidColorOptions } from "@/lib/text-color-effects";
import type { DesignBox } from "@/lib/design-projects";

export type CanvasElementPanelPlacement = "top" | "right" | "bottom" | "left";
export type CanvasEditorResizeCorner = "top-left" | "top" | "top-right" | "right" | "bottom-right" | "bottom" | "bottom-left" | "left";
export type CanvasEditorTextAlign = "left" | "center" | "right";
export type CanvasEditorLogoAssetType = "png" | "svg";

export type CanvasEditorElementAction = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
};

export type CanvasEditorBasicIconOption = {
  id: string;
  label: string;
  glyph: string;
};

export const canvasEditorBasicIconOptions: CanvasEditorBasicIconOption[] = [
  { id: "name", label: "이름", glyph: "이름" },
  { id: "role", label: "직함", glyph: "직함" },
  { id: "mobile", label: "전화번호", glyph: "010" },
  { id: "phone", label: "대표전화", glyph: "TEL" },
  { id: "email", label: "메일", glyph: "@" },
  { id: "location", label: "위치", glyph: "PIN" },
  { id: "fax", label: "팩스", glyph: "FAX" },
  { id: "web", label: "웹", glyph: "WEB" },
  { id: "account", label: "계좌번호", glyph: "KRW" },
  { id: "instagram", label: "인스타그램", glyph: "IG" },
  { id: "projector", label: "빔프로젝트", glyph: "빔" },
  { id: "screen", label: "스크린", glyph: "스크린" },
  { id: "speaker", label: "스피커", glyph: "음향" },
  { id: "led", label: "LED", glyph: "LED" },
];

export function canvasEditorBasicIconActions(createAction: (option: CanvasEditorBasicIconOption) => Pick<CanvasEditorElementAction, "onClick"> & Partial<Omit<CanvasEditorElementAction, "id" | "onClick">>): CanvasEditorElementAction[] {
  return canvasEditorBasicIconOptions.map((option) => ({ id: option.id, label: option.label, ...createAction(option) }));
}

export function canvasEditorBackgroundGridActions({ backgroundColor, showGrid, onBackgroundColorChange, onShowGridChange }: { backgroundColor: string; showGrid: boolean; onBackgroundColorChange: (backgroundColor: string) => void; onShowGridChange: (showGrid: boolean) => void }): CanvasEditorElementAction[] {
  return [
    { id: "background", label: "배경색", icon: <CanvasEditorColorSwatchInput value={backgroundColor} onChange={onBackgroundColorChange} />, onClick: () => undefined },
    { id: "grid", label: showGrid ? "격자 끄기" : "격자 보기", active: showGrid, onClick: () => onShowGridChange(!showGrid) },
  ];
}

export function canvasEditorCoreElementActions({ logoActive, onLogoAdd, onHeadlineAdd, onBodyAdd }: { logoActive?: boolean; onLogoAdd: () => void; onHeadlineAdd: () => void; onBodyAdd: () => void }): CanvasEditorElementAction[] {
  return [
    { id: "logo", label: "로고", active: logoActive, onClick: onLogoAdd },
    { id: "headline", label: "문구 추가", onClick: onHeadlineAdd },
    { id: "body", label: "상세 안내 추가", onClick: onBodyAdd },
  ];
}

export function canvasEditorMappedElementActions<T>(items: readonly T[], createAction: (item: T) => CanvasEditorElementAction): CanvasEditorElementAction[] {
  return items.map((item) => createAction(item));
}

type CanvasEditorPanelFrameProps = {
  title?: string;
  placement?: CanvasElementPanelPlacement;
  children: ReactNode;
};

type CanvasEditorElementPanelProps = Omit<CanvasEditorPanelFrameProps, "children"> & {
  actions: CanvasEditorElementAction[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

type CanvasEditorFloatingControlsProps = {
  fixed?: boolean;
  fixedViewport?: boolean;
  portal?: boolean;
  verticalAnchor?: "top" | "bottom";
  title?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
};

type CanvasEditorFloatingHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLDivElement>) => void;
};

type CanvasEditorFloatingVisibilityHeaderProps = Omit<CanvasEditorFloatingHeaderProps, "actions"> & {
  checked: boolean;
  compact?: boolean;
  mini?: boolean;
  label?: string;
  onCheckedChange: (checked: boolean) => void;
};

type CanvasEditorFloatingVisibilityControlsProps = Omit<CanvasEditorFloatingControlsProps, "title" | "actions"> & {
  title: ReactNode;
  checked: boolean;
  compact?: boolean;
  mini?: boolean;
  label?: string;
  onCheckedChange: (checked: boolean) => void;
};

type CanvasEditorFloatingTitleProps = {
  children: ReactNode;
  className?: string;
};

type SharedCanvasEditorModuleProps = {
  elementAdd: ReactNode;
  editCanvas: ReactNode;
  basicIcons: ReactNode;
  editPreview: ReactNode;
  elementAddPlacement?: CanvasElementPanelPlacement;
  className?: string;
};

type CanvasEditorZoomFrameProps = {
  children: ReactNode | ((state: { zoom: number }) => ReactNode);
  className?: string;
  contentClassName?: string;
  toolbarActions?: ReactNode;
  toolbarPanel?: ReactNode;
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
};

type CanvasEditorResizeHandlesProps = {
  onResizePointerDown: (event: PointerEvent<HTMLSpanElement>, corner: CanvasEditorResizeCorner) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
};

type CanvasEditorSelectableBoxProps = {
  box: DesignBox;
  selected: boolean;
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  selectedClassName?: string;
  idleClassName?: string;
  style?: CSSProperties;
  resizeHandles?: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown?: (event: PointerEvent<HTMLSpanElement>, corner: CanvasEditorResizeCorner) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
  tabIndex?: number;
};

type CanvasEditorBoxControlsProps = {
  box: DesignBox;
  minSize?: number;
  className?: string;
  onChange: (key: keyof DesignBox, value: number) => void;
  renderNumberInput: (props: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) => ReactNode;
};

type CanvasEditorBoxNumberControlsProps = Omit<CanvasEditorBoxControlsProps, "renderNumberInput"> & Pick<CanvasEditorNumberInputProps, "step" | "arrowStep" | "emptyValue" | "labelClassName" | "inputClassName" | "normalizeValue"> & {
  displayValue?: (value: number, step: number) => string;
};

type CanvasEditorTextFormatButtonsProps = {
  fontWeight?: "regular" | "bold";
  italic?: boolean;
  align?: CanvasEditorTextAlign;
  alignLabels?: Record<CanvasEditorTextAlign, string>;
  onFontWeightChange?: (fontWeight: "regular" | "bold") => void;
  onItalicChange?: (italic: boolean) => void;
  onAlignChange?: (align: CanvasEditorTextAlign) => void;
};

type CanvasEditorTextStyleControlsProps = CanvasEditorTextFormatButtonsProps & {
  fontFamily: string;
  fontOptions: readonly string[];
  fontLabels: Record<string, string>;
  color: string;
  className?: string;
  onFontFamilyChange: (fontFamily: string) => void;
  onColorChange: (color: string) => void;
  renderColorInput?: (props: { label: string; value: string; onChange: (value: string) => void }) => ReactNode;
};

type CanvasEditorTextContentInputProps = {
  label: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  textareaClassName?: string;
  onChange: (value: string) => void;
};

type CanvasEditorFontSelectProps = {
  value: string;
  options: readonly string[];
  labels: Record<string, string>;
  onChange: (value: string) => void;
  label?: string;
  labelClassName?: string;
  selectClassName?: string;
};

type CanvasEditorSelectInputProps = {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  labelClassName?: string;
  selectClassName?: string;
};

type CanvasEditorLogoAssetTypeButtonsProps = {
  value: CanvasEditorLogoAssetType;
  onChange: (value: CanvasEditorLogoAssetType) => void;
  labels?: Record<CanvasEditorLogoAssetType, string>;
  disabled?: Partial<Record<CanvasEditorLogoAssetType, boolean>>;
  className?: string;
  buttonClassName?: string;
};

type CanvasEditorCheckboxPillProps = {
  label: string;
  checked: boolean;
  compact?: boolean;
  mini?: boolean;
  onChange: (checked: boolean) => void;
};

type CanvasEditorSolidColorInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showTextInput?: boolean;
  normalizeColorInput?: (value: string) => string | undefined;
  labelClassName?: string;
  wrapperClassName?: string;
  swatchClassName?: string;
  textInputClassName?: string;
};

type CanvasEditorTextColorInputProps = CanvasEditorSolidColorInputProps;

type CanvasEditorColorSwatchInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

type CanvasEditorNumberInputProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  arrowStep?: number;
  displayValue?: string;
  emptyValue?: number;
  labelClassName?: string;
  inputClassName?: string;
  normalizeValue?: (value: number, min: number, max: number, step: number) => number;
  onChange: (value: number) => void;
};

const canvasEditorResizeCorners: Array<{ corner: CanvasEditorResizeCorner; className: string; cursorClassName: string }> = [
  { corner: "top-left", className: "left-0 top-0", cursorClassName: "cursor-nwse-resize" },
  { corner: "top", className: "left-1/2 top-0 -translate-x-1/2", cursorClassName: "cursor-ns-resize" },
  { corner: "top-right", className: "right-0 top-0", cursorClassName: "cursor-nesw-resize" },
  { corner: "right", className: "right-0 top-1/2 -translate-y-1/2", cursorClassName: "cursor-ew-resize" },
  { corner: "bottom-right", className: "bottom-0 right-0", cursorClassName: "cursor-nwse-resize" },
  { corner: "bottom", className: "bottom-0 left-1/2 -translate-x-1/2", cursorClassName: "cursor-ns-resize" },
  { corner: "bottom-left", className: "bottom-0 left-0", cursorClassName: "cursor-nesw-resize" },
  { corner: "left", className: "left-0 top-1/2 -translate-y-1/2", cursorClassName: "cursor-ew-resize" },
];

const placementClasses: Record<CanvasElementPanelPlacement, string> = {
  top: "order-first w-full",
  right: "w-full md:sticky md:top-2 md:max-h-[calc(100vh-1rem)] md:overflow-auto",
  bottom: "order-last w-full",
  left: "w-full md:sticky md:top-2 md:max-h-[calc(100vh-1rem)] md:overflow-auto",
};

export function CanvasEditorPanelFrame({ title = "요소 추가", placement = "right", children }: CanvasEditorPanelFrameProps) {
  return (
    <section className={`${placementClasses[placement]} rounded-lg bg-surface p-3`}>
      {title ? <p className="mb-3 text-xs font-black text-primary-strong">{title}</p> : null}
      {children}
    </section>
  );
}

export function CanvasEditorElementPanel({ title = "요소 추가", placement = "right", actions, collapsible = false, defaultCollapsed = false }: CanvasEditorElementPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsible) {
    return (
      <section className={`${placementClasses[placement]} rounded-lg bg-surface p-3`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-black text-primary-strong">{title}</p>
          <button className="rounded-sm bg-surface-blue px-3 py-1.5 text-xs font-black text-primary-strong" type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? "펼치기" : "접기"}
          </button>
        </div>
        <div className={`${collapsed ? "hidden" : "flex"} flex-wrap gap-2`}>
          {actions.map((action) => (
            <button key={action.id} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${action.active ? "bg-primary text-white" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" disabled={action.disabled} aria-pressed={action.active} onClick={action.onClick}>
              {action.icon ? <span className="grid h-7 w-7 place-items-center">{action.icon}</span> : null}
              {action.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <CanvasEditorPanelFrame title={title} placement={placement}>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button key={action.id} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${action.active ? "bg-primary text-white" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" disabled={action.disabled} aria-pressed={action.active} onClick={action.onClick}>
            {action.icon ? <span className="grid h-7 w-7 place-items-center">{action.icon}</span> : null}
            {action.label}
          </button>
        ))}
      </div>
    </CanvasEditorPanelFrame>
  );
}

export function CanvasEditorFloatingControls({ fixed = false, fixedViewport = false, portal = false, verticalAnchor = "top", title, actions, style, children, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: CanvasEditorFloatingControlsProps) {
  const [mounted, setMounted] = useState(false);
  const positionClassName = fixed ? "relative w-full" : fixedViewport ? "fixed z-[2147483647] w-[15rem] max-w-[min(15rem,calc(100vw-1rem))]" : "absolute z-[2147483647] w-[15rem] max-w-[min(15rem,calc(100vw-1rem))]";
  const anchorClassName = fixed || fixedViewport ? "" : verticalAnchor === "bottom" ? "origin-bottom -translate-y-full" : "";

  useEffect(() => {
    setMounted(true);
  }, []);

  const panel = (
    <div data-canvas-floating-panel="true" className={`${positionClassName} ${anchorClassName} grid min-w-0 touch-none gap-2 overflow-hidden rounded-lg border border-line bg-surface/95 p-2 shadow-floating backdrop-blur`} style={style} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-1">
          {title}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );

  return portal && mounted ? createPortal(panel, document.body) : panel;
}

export function CanvasEditorFloatingHeader({ title, actions, className = "flex min-h-6 cursor-move touch-none flex-wrap items-center justify-between gap-2 rounded-sm px-1", onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: CanvasEditorFloatingHeaderProps) {
  return (
    <div className={className} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <CanvasEditorFloatingTitle>{title}</CanvasEditorFloatingTitle>
      {actions}
    </div>
  );
}

export function CanvasEditorFloatingVisibilityHeader({ title, checked, compact, mini, label = "표시", onCheckedChange, ...headerProps }: CanvasEditorFloatingVisibilityHeaderProps) {
  return <CanvasEditorFloatingHeader title={title} actions={<CanvasEditorCheckboxPill label={label} checked={checked} compact={compact} mini={mini} onChange={onCheckedChange} />} {...headerProps} />;
}

export function CanvasEditorFloatingVisibilityControls({ title, checked, compact, mini, label = "표시", onCheckedChange, children, ...controlsProps }: CanvasEditorFloatingVisibilityControlsProps) {
  return (
    <CanvasEditorFloatingControls title={<CanvasEditorFloatingTitle>{title}</CanvasEditorFloatingTitle>} actions={<CanvasEditorCheckboxPill label={label} checked={checked} compact={compact} mini={mini} onChange={onCheckedChange} />} {...controlsProps}>
      {children}
    </CanvasEditorFloatingControls>
  );
}

export function CanvasEditorFloatingTitle({ children, className = "select-none text-[11px] font-black text-primary-strong" }: CanvasEditorFloatingTitleProps) {
  return <span className={className}>{children}</span>;
}

export function CanvasEditorResizeHandles({ onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel }: CanvasEditorResizeHandlesProps) {
  return (
    <>
      {canvasEditorResizeCorners.map((item) => (
        <span key={item.corner} className={`absolute z-10 h-1 w-1 rounded-full border border-primary bg-surface shadow-soft ring-1 ring-primary-soft transition hover:scale-150 ${item.className} ${item.cursorClassName}`} aria-hidden="true" onPointerDown={(event) => onResizePointerDown(event, item.corner)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} />
      ))}
    </>
  );
}

export function CanvasEditorSelectableBox({ box, selected, ariaLabel, children, className = "", selectedClassName = "border-primary bg-primary/10 shadow-soft ring-2 ring-primary-soft", idleClassName = "border-transparent bg-transparent hover:border-primary-soft/60", style, resizeHandles = true, onPointerDown, onResizePointerDown, onPointerMove, onPointerUp, onPointerCancel, tabIndex = 0 }: CanvasEditorSelectableBoxProps) {
  return (
    <div className={`absolute touch-none cursor-grab rounded-sm border transition active:cursor-grabbing ${selected ? selectedClassName : idleClassName} ${className}`} role="button" tabIndex={tabIndex} aria-label={ariaLabel} style={{ ...canvasBoxStyle(box), ...style }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      {children}
      {selected && resizeHandles && onResizePointerDown ? <CanvasEditorResizeHandles onResizePointerDown={onResizePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} /> : null}
    </div>
  );
}

export function CanvasEditorBoxControls({ box, minSize = 1, className = "grid grid-cols-4 gap-0.5", onChange, renderNumberInput }: CanvasEditorBoxControlsProps) {
  return (
    <div className={className}>
      {renderNumberInput({ label: "X", value: box.x, min: -100, max: 100, onChange: (value) => onChange("x", value) })}
      {renderNumberInput({ label: "Y", value: box.y, min: -100, max: 100, onChange: (value) => onChange("y", value) })}
      {renderNumberInput({ label: "가로", value: box.width, min: Math.max(10, minSize), max: 100, onChange: (value) => onChange("width", value) })}
      {renderNumberInput({ label: "세로", value: box.height, min: minSize, max: 100, onChange: (value) => onChange("height", value) })}
    </div>
  );
}

export function CanvasEditorBoxNumberControls({ box, minSize, className, step = 0.5, arrowStep, emptyValue, labelClassName, inputClassName, displayValue, normalizeValue, onChange }: CanvasEditorBoxNumberControlsProps) {
  return (
    <CanvasEditorBoxControls box={box} minSize={minSize} className={className} onChange={onChange} renderNumberInput={(props) => <CanvasEditorNumberInput {...props} step={step} arrowStep={arrowStep} emptyValue={emptyValue} labelClassName={labelClassName} inputClassName={inputClassName} displayValue={displayValue?.(props.value, step)} normalizeValue={normalizeValue} />} />
  );
}

export function CanvasEditorTextFormatButtons({ fontWeight, italic, align, alignLabels = { left: "좌측", center: "중앙", right: "우측" }, onFontWeightChange, onItalicChange, onAlignChange }: CanvasEditorTextFormatButtonsProps) {
  return (
    <div className="flex min-w-0 items-end gap-1">
      {onFontWeightChange ? <button className={`grid h-7 w-7 place-items-center rounded-sm text-xs font-black ${fontWeight === "bold" ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" aria-label="굵게" onClick={() => onFontWeightChange(fontWeight === "bold" ? "regular" : "bold")}>B</button> : null}
      {onItalicChange ? <button className={`grid h-7 w-7 place-items-center rounded-sm text-xs font-black italic ${italic ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" aria-label="이탤릭" onClick={() => onItalicChange(!italic)}>I</button> : null}
      {onAlignChange ? (["left", "center", "right"] satisfies CanvasEditorTextAlign[]).map((item) => <button key={item} className={`grid h-7 w-7 place-items-center rounded-sm text-xs font-black ${align === item ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" aria-label={alignLabels[item]} onClick={() => onAlignChange(item)}>{item === "left" ? "≡" : item === "center" ? "☰" : "≣"}</button>) : null}
    </div>
  );
}

export function CanvasEditorTextStyleControls({ fontFamily, fontOptions, fontLabels, color, className = "grid grid-cols-[72px_minmax(0,1fr)] items-end gap-2", fontWeight, italic, align, alignLabels, onFontFamilyChange, onColorChange, onFontWeightChange, onItalicChange, onAlignChange, renderColorInput }: CanvasEditorTextStyleControlsProps) {
  return (
    <div className={className}>
      <CanvasEditorFontSelect value={fontFamily} options={fontOptions} labels={fontLabels} onChange={onFontFamilyChange} />
      <div className="flex min-w-0 items-end gap-2">
        {renderColorInput ? renderColorInput({ label: "색", value: color, onChange: onColorChange }) : <CanvasEditorTextColorInput label="색" value={color} onChange={onColorChange} />}
        <CanvasEditorTextFormatButtons fontWeight={fontWeight} italic={italic} align={align} alignLabels={alignLabels} onFontWeightChange={onFontWeightChange} onItalicChange={onItalicChange} onAlignChange={onAlignChange} />
      </div>
    </div>
  );
}

export function CanvasEditorTextContentInput({ label, value, placeholder, multiline = false, labelClassName = "text-[10px] font-extrabold text-soft", inputClassName = "h-5 w-full rounded-sm border border-line bg-surface px-1 text-[9px] font-black text-ink outline-none focus:border-primary", textareaClassName = "min-h-10 w-full resize-y rounded-sm border border-line bg-surface px-1 py-1 text-[9px] font-black text-ink outline-none focus:border-primary", onChange }: CanvasEditorTextContentInputProps) {
  return (
    <label className="grid gap-1">
      <span className={labelClassName}>{label}</span>
      {multiline ? <textarea className={textareaClassName} value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} /> : <input className={inputClassName} value={value} placeholder={placeholder} onChange={(event) => onChange(event.currentTarget.value)} />}
    </label>
  );
}

export function CanvasEditorFontSelect({ value, options, labels, onChange, label = "폰트", labelClassName = "mb-0.5 block text-[8px] font-extrabold text-soft", selectClassName = "h-4 w-full rounded-sm border border-line bg-surface px-0.5 text-[8px] font-black text-ink outline-none focus:border-primary" }: CanvasEditorFontSelectProps) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <select className={selectClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}
      </select>
    </label>
  );
}

export function CanvasEditorSelectInput({ label, value, options, onChange, labelClassName = "mb-1 block text-[10px] font-extrabold text-soft", selectClassName = "h-8 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" }: CanvasEditorSelectInputProps) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <select className={selectClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function CanvasEditorLogoAssetTypeButtons({ value, onChange, labels = { png: "PNG", svg: "SVG" }, disabled, className = "flex flex-wrap gap-1", buttonClassName = "h-8 rounded-sm px-2 text-[10px] font-black" }: CanvasEditorLogoAssetTypeButtonsProps) {
  return (
    <div className={className}>
      {(["png", "svg"] satisfies CanvasEditorLogoAssetType[]).map((item) => (
        <button key={item} className={`${buttonClassName} disabled:cursor-not-allowed disabled:opacity-50 ${value === item ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`} type="button" disabled={disabled?.[item]} onClick={() => onChange(item)}>
          {labels[item]}
        </button>
      ))}
    </div>
  );
}

export function CanvasEditorCheckboxPill({ label, checked, compact = false, mini = false, onChange }: CanvasEditorCheckboxPillProps) {
  if (mini) {
    return <label className={`flex h-7 items-center gap-1 rounded-sm px-2 text-[10px] font-black ${checked ? "bg-primary text-white" : "bg-surface-blue text-primary-strong"}`}><input className="h-3 w-3 accent-[var(--color-primary)]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
  }

  return (
    <label className={`inline-flex cursor-pointer items-center rounded-md font-black transition ${compact ? "gap-1 px-2 py-1 text-[10px]" : "gap-2 px-3 py-2 text-xs"} ${checked ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong"}`}>
      <input className={`${compact ? "h-3 w-3" : "h-4 w-4"} accent-primary`} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function useCanvasEditorDraftNumberInput(displayValue: string) {
  const [draftValue, setDraftValue] = useState(displayValue);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraftValue(displayValue);
  }, [displayValue, isFocused]);

  return { draftValue, setDraftValue, isFocused, setIsFocused };
}

export function CanvasEditorNumberInput({ label, value, min, max, step = 0.5, arrowStep = 0.5, displayValue = String(value), emptyValue, labelClassName = "mb-0.5 block text-[8px] font-extrabold text-soft", inputClassName = "h-7 w-full min-w-0 rounded-sm border border-line bg-surface px-1.5 text-[11px] font-black text-ink outline-none focus:border-primary", normalizeValue, onChange }: CanvasEditorNumberInputProps) {
  const { draftValue, setDraftValue, setIsFocused } = useCanvasEditorDraftNumberInput(displayValue);
  const commitNumber = (nextValue: number) => {
    const committedValue = normalizeValue ? normalizeValue(nextValue, min, max, step) : Math.min(Math.max(nextValue, min), max);

    setDraftValue(String(committedValue));
    onChange(committedValue);
  };
  const commitValue = (rawValue: string) => {
    if (!rawValue.trim()) {
      if (emptyValue === undefined) {
        setDraftValue(displayValue);
        return;
      }

      commitNumber(emptyValue);
      return;
    }

    const nextValue = Number(rawValue);

    if (Number.isFinite(nextValue)) {
      commitNumber(nextValue);
      return;
    }

    setDraftValue(displayValue);
  };

  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <input className={inputClassName} type="text" inputMode="decimal" value={draftValue} onFocus={() => setIsFocused(true)} onBlur={(event) => { setIsFocused(false); commitValue(event.currentTarget.value); }} onChange={(event) => setDraftValue(event.currentTarget.value)} onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          commitNumber(value + (event.key === "ArrowUp" ? arrowStep : -arrowStep));
          return;
        }
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }} data-step={step} />
    </label>
  );
}

export function CanvasEditorColorSwatchInput({ value, onChange, className = "h-7 w-7 cursor-pointer rounded-sm border border-line bg-surface p-0.5 outline-none focus:border-primary" }: CanvasEditorColorSwatchInputProps) {
  return <input className={className} type="color" value={value} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange(event.target.value)} />;
}

function commitCanvasEditorColorInput(input: HTMLInputElement, currentValue: string, onChange: (value: string) => void, normalizeColorInput?: (value: string) => string | undefined) {
  const color = normalizeColorInput ? normalizeColorInput(input.value) : input.value.trim();

  if (color) {
    onChange(color);
    return;
  }

  input.value = currentValue;
}

export function CanvasEditorSolidColorInput({ label, value, onChange, showTextInput = false, normalizeColorInput, labelClassName = "mb-1 block text-[10px] font-extrabold text-soft", wrapperClassName, swatchClassName = "h-6 w-6 cursor-pointer rounded-sm border border-line bg-surface p-0.5 outline-none focus:border-primary", textInputClassName = "h-6 w-full min-w-0 rounded-sm border border-line bg-surface px-1 text-[9px] font-black text-ink outline-none focus:border-primary" }: CanvasEditorSolidColorInputProps) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <div className={wrapperClassName}>
        <input className={swatchClassName} type="color" value={textColorInputValue(value)} onChange={(event) => onChange(event.target.value)} />
        {showTextInput ? <input key={`${label}-${value}`} className={textInputClassName} type="text" defaultValue={value} onBlur={(event) => commitCanvasEditorColorInput(event.currentTarget, value, onChange, normalizeColorInput)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> : null}
      </div>
    </label>
  );
}

export function CanvasEditorTextColorInput({ label, value, onChange, showTextInput = false, normalizeColorInput, labelClassName = "mb-1 block text-[10px] font-extrabold text-soft", wrapperClassName = "flex items-center gap-1", swatchClassName = "h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-line bg-surface p-0.5 outline-none focus:border-primary", textInputClassName = "h-6 min-w-0 flex-1 rounded-sm border border-line bg-surface px-1 text-[9px] font-black text-ink outline-none focus:border-primary" }: CanvasEditorTextColorInputProps) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <div className={wrapperClassName}>
        <input className={swatchClassName} type="color" value={textColorInputValue(value)} onChange={(event) => onChange(event.target.value)} />
        {textSolidColorOptions.map((color) => <button key={color} className={`h-4 w-7 shrink-0 rounded-full border ${color === "#ffffff" ? "border-ink/25" : "border-line"} ${value === color ? "ring-2 ring-primary" : ""}`} style={{ backgroundColor: color }} type="button" aria-label={color} title={color} onClick={() => onChange(color)} />)}
        {textGradientOptions.map((option) => <button key={option.value} className={`h-4 w-7 shrink-0 rounded-full border border-line bg-cover bg-center ${value === option.value ? "ring-2 ring-primary" : ""}`} style={{ backgroundImage: option.background }} type="button" aria-label={option.title} title={option.title} onClick={() => onChange(option.value)} />)}
        {showTextInput ? <input key={`${label}-${value}`} className={textInputClassName} type="text" defaultValue={value} onBlur={(event) => commitCanvasEditorColorInput(event.currentTarget, value, onChange, normalizeColorInput)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /> : null}
      </div>
    </label>
  );
}

type PinchTouchList = { length: number; item: (index: number) => { clientX: number; clientY: number } | null };

function clampZoom(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CanvasEditorZoomFrame({ children, className, contentClassName, toolbarActions, toolbarPanel, minZoom = 0.65, maxZoom = 3, onZoomChange }: CanvasEditorZoomFrameProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | undefined>(undefined);
  const touchPanRef = useRef<{ centerX: number; centerY: number; panX: number; panY: number } | undefined>(undefined);
  const zoomPercent = Math.round(zoom * 100);

  useEffect(() => {
    onZoomChange?.(zoom);
  }, [onZoomChange, zoom]);

  const updateZoom = (nextZoom: number) => setZoom(clampZoom(Number(nextZoom.toFixed(2)), minZoom, maxZoom));
  const readTouchCenter = (touches: PinchTouchList) => {
    const first = touches.item(0);
    const second = touches.item(1);

    return first && second ? { x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2 } : undefined;
  };
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      const center = readTouchCenter(event.touches);
      if (center) touchPanRef.current = { centerX: center.x, centerY: center.y, panX: pan.x, panY: pan.y };
    }
  };
  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !touchPanRef.current) return;
    const center = readTouchCenter(event.touches);

    if (center) {
      event.preventDefault();
      setPan({ x: touchPanRef.current.panX + center.x - touchPanRef.current.centerX, y: touchPanRef.current.panY + center.y - touchPanRef.current.centerY });
    }
  };
  const handleTouchEnd = () => {
    touchPanRef.current = undefined;
  };
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;

    if (event.pointerType !== "mouse" || event.button !== 1) return;
    if (target instanceof HTMLElement && target.closest("button,input,textarea,select,label,[role='button']")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return;
    setPan({ x: panRef.current.panX + event.clientX - panRef.current.startX, y: panRef.current.panY + event.clientY - panRef.current.startY });
  };
  const stopPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = undefined;
  };

  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-black text-primary-strong">
        <div className="flex flex-wrap items-center gap-2">{toolbarActions}</div>
        <div className="flex items-center justify-end gap-2">
          <button className="inline-flex items-center gap-1 rounded-sm bg-surface-blue px-2 py-1" type="button" aria-label="캔버스 축소" onClick={() => updateZoom(zoom - 0.1)}><MagnifierIcon minus />축소</button>
          <span className="min-w-12 text-center">{zoomPercent}%</span>
          <button className="inline-flex items-center gap-1 rounded-sm bg-surface-blue px-2 py-1" type="button" aria-label="캔버스 확대" onClick={() => updateZoom(zoom + 0.1)}><MagnifierIcon />확대</button>
          <button className="rounded-sm bg-surface-blue px-2 py-1" type="button" onClick={() => updateZoom(1)}>초기화</button>
        </div>
      </div>
      {toolbarPanel}
      <div className="phone-scroll overflow-auto rounded-lg" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd} onPointerDownCapture={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan}>
        <div className={`origin-top-left transition-transform ${contentClassName ?? ""}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {typeof children === "function" ? children({ zoom }) : children}
        </div>
      </div>
    </div>
  );
}

function MagnifierIcon({ minus = false }: { minus?: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="m15.5 15.5 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 10.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {minus ? null : <path d="M10.5 7.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

function SharedCanvasEditorBody({ elementAdd, editCanvas, basicIcons, editPreview, elementAddPlacement }: SharedCanvasEditorModuleProps) {
  const inlineElementAdd = elementAddPlacement === "top" || elementAddPlacement === "bottom" ? <div>{elementAdd}</div> : null;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4">
        <div className="min-w-0">
          {editCanvas}
        </div>
        {inlineElementAdd}
        {basicIcons}
      </div>
      <div className="min-w-0 rounded-lg bg-surface p-2 sm:p-3">
        <p className="mb-3 text-xs font-black text-primary-strong">편집화면 미리보기</p>
        {editPreview}
      </div>
    </div>
  );
}

export function SharedCanvasEditorModule({ elementAdd, editCanvas, basicIcons, editPreview, elementAddPlacement = "top", className }: SharedCanvasEditorModuleProps) {
  const body = <SharedCanvasEditorBody elementAdd={elementAdd} editCanvas={editCanvas} basicIcons={basicIcons} editPreview={editPreview} elementAddPlacement={elementAddPlacement} />;
  const elementAddPanel = <div className="min-w-0">{elementAdd}</div>;

  if (elementAddPlacement === "left" || elementAddPlacement === "right") {
    return (
      <section className={`grid gap-4 rounded-lg bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-3 sm:p-4 ${className ?? ""}`}>
        <div className={`grid gap-4 ${elementAddPlacement === "left" ? "lg:grid-cols-[260px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_260px]"}`}>
          {elementAddPlacement === "left" ? elementAddPanel : body}
          {elementAddPlacement === "left" ? body : elementAddPanel}
        </div>
      </section>
    );
  }

  return (
    <section className={`grid gap-4 rounded-lg bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-3 sm:p-4 ${className ?? ""}`}>
      {body}
    </section>
  );
}
