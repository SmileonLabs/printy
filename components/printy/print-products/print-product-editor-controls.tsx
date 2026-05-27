import { CanvasEditorQrImageControl, CanvasEditorRoundedBoxNumberControls, canvasEditorFontLabels, canvasEditorTextAlignLabels, readCanvasEditorFontFamily, type CanvasEditorTextControlModel } from "@/components/design-production/canvas-editor-control-primitives";
import { CanvasEditorFloatingVisibilityControls, CanvasEditorFontSelect, CanvasEditorLogoAssetTypeButtons, CanvasEditorSolidColorInput, CanvasEditorTextColorInput, CanvasEditorTextContentInput, CanvasEditorTextFormatButtons } from "@/components/design-production/canvas-editor-panels";
import { TextAreaField, TextField } from "@/components/ui";
import { businessCardTemplateFontFamilies } from "@/lib/business-card-templates";
import type { PrintProductProductionBox, PrintProductProductionField, PrintProductProductionLayout, PrintProductPromptShape } from "@/lib/types";

function isBodyField(field: PrintProductProductionField) {
  return field.id === "body" || field.id.startsWith("body-");
}

function printProductTextControlModel(field: PrintProductProductionField): CanvasEditorTextControlModel {
  return {
    id: field.id,
    title: `${field.label}${field.id === "qrCode" ? "" : " 텍스트"}`,
    value: field.value,
    visible: field.visible,
    multiline: isBodyField(field),
    fontFamily: field.fontFamily ?? "sans",
    color: field.color,
    fontWeight: field.fontWeight,
    italic: Boolean(field.italic),
    align: field.align,
  };
}

export function LogoControls({ layout, logoVectorSvgUrl, onChange, onLogoBoxChange }: { layout: PrintProductProductionLayout; logoVectorSvgUrl?: string; onChange: (layout: PrintProductProductionLayout) => void; onLogoBoxChange: (key: keyof PrintProductProductionBox, value: number) => void }) {
  return (
    <CanvasEditorFloatingVisibilityControls fixed title="로고" checked={layout.logo.visible} mini onCheckedChange={(visible) => onChange({ ...layout, logo: { ...layout.logo, visible } })}>
      <CanvasEditorRoundedBoxNumberControls box={layout.logo.box} onChange={onLogoBoxChange} />
      <CanvasEditorLogoAssetTypeButtons value={layout.logo.assetType === "svg" ? "svg" : "png"} disabled={{ svg: !logoVectorSvgUrl }} onChange={(assetType) => onChange({ ...layout, logo: { ...layout.logo, assetType } })} />
    </CanvasEditorFloatingVisibilityControls>
  );
}

export function FieldControls({ field, qrError, onFieldChange, onFieldBoxChange, onQrImageChange, onQrImageClear }: { field: PrintProductProductionField; qrError: string; onFieldChange: (patch: Partial<PrintProductProductionField>) => void; onFieldBoxChange: (key: keyof PrintProductProductionBox, value: number) => void; onQrImageChange: (file: File | undefined) => void; onQrImageClear: () => void }) {
  const model = printProductTextControlModel(field);
  return (
    <CanvasEditorFloatingVisibilityControls fixed title={model.title} checked={model.visible} mini onCheckedChange={(visible) => onFieldChange({ visible })}>
      <CanvasEditorRoundedBoxNumberControls box={field.box} onChange={onFieldBoxChange} />
      {field.id === "qrCode" ? <CanvasEditorQrImageControl value={model.value} onChange={onQrImageChange} onClear={onQrImageClear} /> : (
        <>
          <div className="grid grid-cols-[60px_repeat(5,20px)] items-end gap-1">
            <CanvasEditorFontSelect value={model.fontFamily} options={businessCardTemplateFontFamilies} labels={canvasEditorFontLabels} onChange={(value) => onFieldChange({ fontFamily: readCanvasEditorFontFamily(value) })} selectClassName="h-7 w-full rounded-sm border border-line bg-surface px-1 text-sm font-black text-ink outline-none focus:border-primary" />
            <CanvasEditorTextFormatButtons fontWeight={model.fontWeight} italic={model.italic} align={model.align} alignLabels={canvasEditorTextAlignLabels} onFontWeightChange={(fontWeight) => onFieldChange({ fontWeight })} onItalicChange={(italic) => onFieldChange({ italic })} onAlignChange={(align) => onFieldChange({ align })} />
          </div>
          <CanvasEditorTextColorInput label="색상" value={model.color} wrapperClassName="flex max-w-72 flex-wrap items-center gap-1" swatchClassName="h-4 w-8 shrink-0 cursor-pointer rounded-sm border border-line bg-surface p-0.5" onChange={(color) => onFieldChange({ color })} />
          <CanvasEditorTextContentInput label="내용" value={model.value} placeholder="문구를 입력해 주세요" multiline={model.multiline} labelClassName="mb-1 block text-[10px] font-extrabold text-soft" inputClassName="h-8 w-full rounded-sm border border-line bg-surface px-2 text-xs font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" textareaClassName="min-h-16 w-full resize-y rounded-sm border border-line bg-surface px-2 py-2 text-xs font-bold leading-5 text-ink outline-none transition focus:border-primary focus:shadow-soft" onChange={(value) => onFieldChange({ value })} />
        </>
      )}
      {qrError ? <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{qrError}</p> : null}
    </CanvasEditorFloatingVisibilityControls>
  );
}

export function PromptShapeControls({ shape, error, isPrompting, onChange, onBoxChange, onRequest }: { shape: PrintProductPromptShape; error: string; isPrompting: boolean; onChange: (patch: Partial<PrintProductPromptShape>) => void; onBoxChange: (key: keyof PrintProductProductionBox, value: number) => void; onRequest: () => void }) {
  return (
    <CanvasEditorFloatingVisibilityControls fixed title="기본 아이콘" checked={shape.visible} mini onCheckedChange={(visible) => onChange({ visible })}>
      <CanvasEditorRoundedBoxNumberControls box={shape.box} onChange={onBoxChange} />
      <TextAreaField label="GPT에게 요청" value={shape.prompt} placeholder="예: 인스타그램 아이콘 그려줘" onChange={(prompt) => onChange({ prompt })} />
      <div className="grid grid-cols-[1fr_28px_28px_28px] items-end gap-1">
        <TextField label="표기" value={shape.glyph} placeholder="IG" onChange={(glyph) => onChange({ glyph: glyph.slice(0, 3) })} />
        <CanvasEditorSolidColorInput label="면" value={shape.fillColor} onChange={(fillColor) => onChange({ fillColor })} />
        <CanvasEditorSolidColorInput label="선" value={shape.strokeColor} onChange={(strokeColor) => onChange({ strokeColor })} />
        <CanvasEditorSolidColorInput label="글" value={shape.textColor} onChange={(textColor) => onChange({ textColor })} />
      </div>
      <button className="h-9 rounded-md bg-primary px-3 text-xs font-black text-white disabled:opacity-60" type="button" disabled={isPrompting} onClick={onRequest}>{isPrompting ? "GPT 요청 중..." : "GPT로 아이콘 제안"}</button>
      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{error}</p> : null}
    </CanvasEditorFloatingVisibilityControls>
  );
}
