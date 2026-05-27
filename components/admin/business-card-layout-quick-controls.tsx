import { type CSSProperties, type ReactNode } from "react";
import { CanvasEditorCompactBoxNumberControls, CanvasEditorQrImageControl, canvasEditorFontLabels, canvasEditorTextAlignLabels, readCanvasEditorFontFamily, type CanvasEditorTextControlModel } from "@/components/design-production/canvas-editor-control-primitives";
import { useCanvasEditorFloatingPanelDrag } from "@/components/design-production/canvas-editor-interactions";
import { CanvasEditorFloatingControls, CanvasEditorFloatingHeader, CanvasEditorFloatingVisibilityHeader, CanvasEditorFontSelect, CanvasEditorLogoAssetTypeButtons, CanvasEditorNumberInput, CanvasEditorSelectInput, CanvasEditorSolidColorInput, CanvasEditorTextColorInput, CanvasEditorTextContentInput, CanvasEditorTextFormatButtons, CanvasEditorTextStyleControls } from "@/components/design-production/canvas-editor-panels";
import { businessCardTemplateFontFamilies, businessCardTemplateIconIds } from "@/lib/business-card-templates";
import { businessCardInfoBlockIconTextGapPx, editableBusinessCardFieldValue, isMultilineBusinessCardTextFieldId, sampleBusinessCardFieldValue, type BusinessCardInfoBlock } from "@/lib/business-card-rendering";
import { clampCanvasValue, roundCanvasPercent, updateCanvasBoxValue } from "@/lib/design-projects";
import type { BusinessCardTemplateBox, BusinessCardTemplateIconElement, BusinessCardTemplateIconId, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId } from "@/lib/types";

type BusinessCardTemplateLogoElement = BusinessCardTemplateLayout["sides"]["front"]["logo"];
type BoxKey = keyof BusinessCardTemplateBox;
type ControlsPosition = { x: number; y: number };
type SelectedItem = { type: "field"; fieldId: BusinessCardTemplateTextFieldId } | { type: "logo" } | { type: "icon"; iconId: string } | { type: "line"; lineId: string } | { type: "info-block"; blockId: string };

type QuickControlsProps = {
  selectedItem: SelectedItem;
  position: ControlsPosition;
  fixed?: boolean;
  portal?: boolean;
  hideLogoVisibility?: boolean;
  field?: BusinessCardTemplateTextElement;
  icon?: BusinessCardTemplateIconElement;
  line?: BusinessCardTemplateLineElement;
  logo?: BusinessCardTemplateLogoElement;
  infoBlock?: BusinessCardInfoBlock;
  userQrCodeImageUrl?: string;
  onUserQrCodeImageChange?: (file: File | undefined) => void;
  onUserQrCodeImageClear?: () => void;
  onPositionChange: (position: ControlsPosition) => void;
  onFieldChange: (updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void;
  onIconChange: (updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => void;
  onLineChange: (updater: (line: BusinessCardTemplateLineElement) => BusinessCardTemplateLineElement) => void;
  onLogoChange: (updater: (logo: BusinessCardTemplateLogoElement) => BusinessCardTemplateLogoElement) => void;
  onInfoBlockChange: (updater: (box: BusinessCardTemplateBox) => BusinessCardTemplateBox) => void;
  onInfoBlockFieldsChange: (updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void;
  onInfoBlockFieldChange: (fieldId: BusinessCardTemplateTextFieldId, updater: (field: BusinessCardTemplateTextElement) => BusinessCardTemplateTextElement) => void;
  onInfoBlockIconChange: (updater: (icon: BusinessCardTemplateIconElement) => BusinessCardTemplateIconElement) => void;
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

const iconLabels: Record<BusinessCardTemplateIconId, string> = {
  name: "이름",
  role: "직함",
  mobile: "전화번호",
  phone: "대표전화",
  email: "메일",
  location: "위치",
  address: "주소",
  fax: "팩스",
  building: "회사",
  company: "회사",
  web: "웹",
  account: "계좌번호",
  instagram: "인스타그램",
  projector: "빔프로젝트",
  screen: "스크린",
  speaker: "스피커",
  led: "LED",
};

export const businessCardInfoBlockLabels: Record<string, string> = {
  phone: "전화 영역",
  mainPhone: "대표전화 영역",
  fax: "FAX 영역",
  email: "이메일 영역",
  website: "도메인 영역",
  address: "주소 영역",
  account: "계좌번호 영역",
};

const iconSelectOptions = businessCardTemplateIconIds.map((iconId) => ({ value: iconId, label: iconLabels[iconId] }));
const lineOrientationOptions = [{ value: "horizontal", label: "가로" }, { value: "vertical", label: "세로" }];

function fieldLabel(fieldId: BusinessCardTemplateTextFieldId) {
  if (fieldId.startsWith("headline-")) return `문구 ${fieldId.replace("headline-", "")}`;
  if (fieldId.startsWith("body-")) return `상세 안내 ${fieldId.replace("body-", "")}`;
  return fixedFieldLabels[fieldId as keyof typeof fixedFieldLabels];
}

function clamp(value: number, min: number, max: number) {
  return clampCanvasValue(value, min, max);
}

function roundPercent(value: number) {
  return roundCanvasPercent(value);
}

function normalizeHexColorInput(value: string) {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : undefined;
}

function updateBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  return updateCanvasBoxValue(box, key, value, { minWidth: 10, maxWidth: 100, minHeight: 1, maxHeight: 100, minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function updateLineBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  if (!Number.isFinite(value)) {
    return box;
  }

  if (key === "width") {
    return { ...box, width: roundPercent(clamp(value, 0.25, 100)) };
  }

  if (key === "height") {
    return { ...box, height: roundPercent(clamp(value, 0.25, 100)) };
  }

  return updateBoxValue(box, key, value);
}

function updateIconBoxValue(box: BusinessCardTemplateBox, key: BoxKey, value: number): BusinessCardTemplateBox {
  return updateCanvasBoxValue(box, key, value, { minWidth: 1, maxWidth: 100, minHeight: 1, maxHeight: 100, minX: -100, maxX: 100, minY: -100, maxY: 100 });
}

function readIconId(value: string): BusinessCardTemplateIconId {
  return businessCardTemplateIconIds.find((iconId) => iconId === value) ?? "phone";
}

function businessCardTextControlModel(field: BusinessCardTemplateTextElement): CanvasEditorTextControlModel {
  return {
    id: field.id,
    title: `${fieldLabel(field.id)} 텍스트`,
    value: editableBusinessCardFieldValue(field.id, field.customValue ?? sampleBusinessCardFieldValue(field.id)),
    visible: field.visible,
    multiline: isMultilineBusinessCardTextFieldId(field.id),
    fontFamily: field.fontFamily,
    color: field.color,
    fontWeight: field.fontWeight,
    italic: field.italic,
    align: field.align,
  };
}

export function QuickControls({ selectedItem, position, fixed = false, portal = false, hideLogoVisibility = false, field, icon, line, logo, infoBlock, userQrCodeImageUrl = "", onUserQrCodeImageChange, onUserQrCodeImageClear, onPositionChange, onFieldChange, onIconChange, onLineChange, onLogoChange, onInfoBlockChange, onInfoBlockFieldsChange, onInfoBlockFieldChange, onInfoBlockIconChange }: QuickControlsProps) {
  const panelDrag = useCanvasEditorFloatingPanelDrag({ position, onPositionChange, clampToViewport: portal });
  const controlsStyle: CSSProperties | undefined = fixed ? undefined : { left: `${position.x}px`, top: `${position.y}px` };
  const renderHeader = (title: string, actions?: ReactNode) => <CanvasEditorFloatingHeader title={title} actions={actions} onPointerDown={panelDrag.startPanelDrag} onPointerMove={panelDrag.movePanelDrag} onPointerUp={panelDrag.stopPanelDrag} onPointerCancel={panelDrag.stopPanelDrag} />;
  const renderVisibilityHeader = (title: string, checked: boolean, onCheckedChange: (checked: boolean) => void, compact?: boolean) => <CanvasEditorFloatingVisibilityHeader title={title} checked={checked} compact={compact} onCheckedChange={onCheckedChange} onPointerDown={panelDrag.startPanelDrag} onPointerMove={panelDrag.movePanelDrag} onPointerUp={panelDrag.stopPanelDrag} onPointerCancel={panelDrag.stopPanelDrag} />;
  const renderPanel = (children: ReactNode) => <CanvasEditorFloatingControls fixed={fixed} fixedViewport={portal} portal={portal} style={controlsStyle}>{children}</CanvasEditorFloatingControls>;

  if (selectedItem.type === "info-block" && infoBlock) {
    const blockFields = infoBlock.rows.flatMap((row) => row.items.map((item) => item.field));
    const firstField = blockFields[0];
    const allVisible = blockFields.every((blockField) => blockField.visible);
    const iconTextGapPx = infoBlock.icon?.textGapPx ?? businessCardInfoBlockIconTextGapPx;

    return renderPanel(
      <>
        {renderVisibilityHeader(businessCardInfoBlockLabels[infoBlock.id] ?? "정보 영역", allVisible, (visible) => onInfoBlockFieldsChange((current) => ({ ...current, visible })))}
        {firstField ? (
          <CanvasEditorTextStyleControls className="grid grid-cols-[18px_67px_19px_23px] items-end gap-0.5" fontFamily={firstField.fontFamily} fontOptions={businessCardTemplateFontFamilies} fontLabels={canvasEditorFontLabels} color={firstField.color} fontWeight={firstField.fontWeight} italic={firstField.italic} onFontFamilyChange={(value) => onInfoBlockFieldsChange((current) => ({ ...current, fontFamily: readCanvasEditorFontFamily(value) }))} onColorChange={(color) => onInfoBlockFieldsChange((current) => ({ ...current, color }))} onFontWeightChange={(fontWeight) => onInfoBlockFieldsChange((current) => ({ ...current, fontWeight }))} onItalicChange={(italic) => onInfoBlockFieldsChange((current) => ({ ...current, italic }))} renderColorInput={(props) => <FontColorInput {...props} />} />
        ) : null}
        <div className="grid gap-1">
          {blockFields.map((blockField) => (
            <label key={blockField.id} className="grid grid-cols-[76px_1fr] items-center gap-2">
              <span className="text-[10px] font-extrabold text-soft">{fieldLabel(blockField.id)}</span>
              <input className="h-8 rounded-sm border border-line bg-surface px-2 text-xs font-black text-ink outline-none focus:border-primary" defaultValue={editableBusinessCardFieldValue(blockField.id, blockField.customValue ?? sampleBusinessCardFieldValue(blockField.id))} onChange={(event) => {
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
        <div className="grid grid-cols-[112px_minmax(0,1fr)] items-end gap-2">
          <CompactBoxControls box={infoBlock.box} onChange={(key, value) => onInfoBlockChange((box) => updateBoxValue(box, key, value))} />
          <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-end gap-2">
            {infoBlock.icon ? <CompactNumberInput label="간격" value={iconTextGapPx} min={0} max={80} step={1} onChange={(value) => onInfoBlockIconChange((current) => ({ ...current, textGapPx: roundPercent(clamp(value, 0, 80)) }))} /> : <span />}
            {firstField ? <CanvasEditorTextFormatButtons align={firstField.align} alignLabels={canvasEditorTextAlignLabels} onAlignChange={(align) => onInfoBlockFieldsChange((current) => ({ ...current, align }))} /> : null}
          </div>
        </div>
        <p className="text-[10px] font-bold leading-4 text-muted">블록 안의 텍스트와 아이콘 좌표가 함께 이동/스케일돼요.</p>
      </>
    );
  }

  if (selectedItem.type === "field" && field) {
    if (field.id === "qrCode") {
      return renderPanel(
        <>
          {renderVisibilityHeader("QR 코드 이미지", field.visible, (visible) => onFieldChange((current) => ({ ...current, visible })), true)}
          <CompactBoxControls box={field.box} className="grid grid-cols-[repeat(4,24px)] gap-0.5" onChange={(key, value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, key, value) }))} />
          {onUserQrCodeImageChange && onUserQrCodeImageClear ? <CanvasEditorQrImageControl value={userQrCodeImageUrl} onChange={onUserQrCodeImageChange} onClear={onUserQrCodeImageClear} /> : null}
        </>
      );
    }

    const model = businessCardTextControlModel(field);

    return renderPanel(
      <>
        {renderVisibilityHeader(model.title, model.visible, (visible) => onFieldChange((current) => ({ ...current, visible })), true)}
        <CompactBoxControls box={field.box} className="grid grid-cols-[repeat(4,34px)] gap-1" onChange={(key, value) => onFieldChange((current) => ({ ...current, box: updateBoxValue(current.box, key, value) }))} />
        <div className="grid grid-cols-[64px_repeat(5,18px)] items-end gap-1">
          <CanvasEditorFontSelect value={model.fontFamily} options={businessCardTemplateFontFamilies} labels={canvasEditorFontLabels} onChange={(value) => onFieldChange((current) => ({ ...current, fontFamily: readCanvasEditorFontFamily(value) }))} selectClassName="h-7 w-full rounded-sm border border-line bg-surface px-1 text-sm font-black text-ink outline-none focus:border-primary" />
          <CanvasEditorTextFormatButtons fontWeight={model.fontWeight} italic={model.italic} align={model.align} alignLabels={canvasEditorTextAlignLabels} onFontWeightChange={(fontWeight) => onFieldChange((current) => ({ ...current, fontWeight }))} onItalicChange={(italic) => onFieldChange((current) => ({ ...current, italic }))} onAlignChange={(align) => onFieldChange((current) => ({ ...current, align }))} />
        </div>
        <FontColorInput label="색상" value={model.color} onChange={(color) => onFieldChange((current) => ({ ...current, color }))} />
        <CanvasEditorTextContentInput label="내용" value={model.value} placeholder="문구를 입력해 주세요" multiline={model.multiline} onChange={(value) => onFieldChange((current) => ({ ...current, customValue: value }))} />
      </>
    );
  }

  if (selectedItem.type === "icon" && icon) {
    return renderPanel(
      <>
        {renderVisibilityHeader("아이콘", icon.visible, (visible) => onIconChange((current) => ({ ...current, visible })))}
        <div className="grid grid-cols-[92px_98px] items-end gap-1">
          <CanvasEditorSelectInput label="아이콘 종류" value={icon.icon} options={iconSelectOptions} onChange={(value) => onIconChange((current) => ({ ...current, icon: readIconId(value) }))} />
          <CompactColorInput label="색" value={icon.color} onChange={(color) => onIconChange((current) => ({ ...current, color }))} />
        </div>
        <CompactBoxControls box={icon.box} onChange={(key, value) => onIconChange((current) => ({ ...current, box: updateIconBoxValue(current.box, key, value) }))} />
      </>
    );
  }

  if (selectedItem.type === "line" && line) {
    const isHorizontal = line.orientation === "horizontal";

    return renderPanel(
      <>
        {renderVisibilityHeader("라인", line.visible, (visible) => onLineChange((current) => ({ ...current, visible })))}
        <div className="grid grid-cols-[76px_98px] items-end gap-1">
          <CanvasEditorSelectInput label="방향" value={line.orientation} options={lineOrientationOptions} onChange={(value) => onLineChange((current) => ({ ...current, orientation: value === "vertical" ? "vertical" : "horizontal" }))} />
          <CompactColorInput label="색" value={line.color} onChange={(color) => onLineChange((current) => ({ ...current, color }))} />
        </div>
        <div className="grid grid-cols-[24px_24px_24px_24px] gap-0.5">
          <CompactNumberInput label="X" value={line.box.x} min={-100} max={100} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateBoxValue(current.box, "x", value) }))} />
          <CompactNumberInput label="Y" value={line.box.y} min={-100} max={100} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateBoxValue(current.box, "y", value) }))} />
          <CompactNumberInput label="길이" value={isHorizontal ? line.box.width : line.box.height} min={0.25} max={100} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateLineBoxValue(current.box, isHorizontal ? "width" : "height", value) }))} />
          <CompactNumberInput label="두께" value={isHorizontal ? line.box.height : line.box.width} min={0.25} max={20} step={0.01} onChange={(value) => onLineChange((current) => ({ ...current, box: updateLineBoxValue(current.box, isHorizontal ? "height" : "width", value) }))} />
        </div>
      </>
    );
  }

  if (selectedItem.type === "logo" && logo) {
    return renderPanel(
      <>
        {hideLogoVisibility ? renderHeader("로고") : renderVisibilityHeader("로고", logo.visible, (visible) => onLogoChange((current) => ({ ...current, visible })))}
        <CompactBoxControls box={logo.box} onChange={(key, value) => onLogoChange((current) => ({ ...current, box: updateBoxValue(current.box, key, value) }))} />
        <CanvasEditorLogoAssetTypeButtons value={logo.assetType === "svg" ? "svg" : "png"} labels={{ png: "PNG 사용", svg: "SVG 사용" }} className="grid grid-cols-2 gap-1" onChange={(assetType) => onLogoChange((current) => ({ ...current, assetType }))} />
      </>
    );
  }

  return null;
}

function CompactBoxControls({ box, className = "grid grid-cols-[24px_24px_24px_24px] gap-0.5", onChange }: { box: BusinessCardTemplateBox; className?: string; onChange: (key: BoxKey, value: number) => void }) {
  return (
    <CanvasEditorCompactBoxNumberControls box={box} className={className} onChange={onChange} />
  );
}

function CompactNumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <CanvasEditorNumberInput label={label} value={value} min={min} max={max} step={step} emptyValue={0} inputClassName="h-7 w-full rounded-sm border border-line bg-surface px-1 text-[11px] font-black text-ink outline-none focus:border-primary" normalizeValue={(nextValue, inputMin, inputMax) => roundPercent(clamp(nextValue, inputMin, inputMax))} onChange={onChange} />;
}

function CompactColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <CanvasEditorSolidColorInput label={label} value={value} showTextInput normalizeColorInput={normalizeHexColorInput} labelClassName="mb-0.5 block text-[9px] font-extrabold text-soft" wrapperClassName="grid min-w-0 grid-cols-[22px_minmax(62px,1fr)] gap-1" swatchClassName="h-6 w-full cursor-pointer rounded-sm border border-line bg-surface p-0.5" onChange={onChange} />;
}

function FontColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <CanvasEditorTextColorInput label={label} value={value} normalizeColorInput={normalizeHexColorInput} labelClassName="mb-0.5 block text-[9px] font-extrabold text-soft" wrapperClassName="flex flex-wrap items-center gap-1" swatchClassName="h-4 w-7 shrink-0 cursor-pointer rounded-full border border-line bg-surface p-0.5" textInputClassName="h-6 w-16 min-w-0 rounded-sm border border-line bg-surface px-1 text-[9px] font-black text-ink outline-none focus:border-primary" onChange={onChange} />;
}
