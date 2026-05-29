"use client";

import type { ReactNode } from "react";
import { AppButton, SoftCard, TextAreaField } from "@/components/ui";

export type ProductionSizeOption = {
  id: string;
  label: string;
};

type ProductionHeaderCardProps = {
  backLabel?: string;
  eyebrow: string;
  description: string;
  onBack?: () => void;
};

type ProductionSizeCardProps = {
  title: string;
  description: string;
  value: string;
  options: ProductionSizeOption[];
  onChange: (value: string) => void;
  sideValue?: string;
  sideOptions?: ProductionSizeOption[];
  onSideChange?: (value: string) => void;
};

type ProductionRequestCardProps = {
  title: string;
  description: string;
  requestLabel?: string;
  requestPlaceholder?: string;
  requestValue?: string;
  onRequestChange?: (value: string) => void;
  primaryLabel: string;
  primaryLoadingLabel?: string;
  isPrimaryLoading?: boolean;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondaryActions?: ReactNode;
  children?: ReactNode;
  notices?: ReactNode;
};

type ProductionAiDesignRequestCardProps = {
  mode: "create" | "edit";
  title?: string;
  description?: string;
  promptValue: string;
  promptPlaceholder: string;
  onPromptChange: (value: string) => void;
  onTemporarySave?: () => void;
  temporarySaveLabel?: string;
  temporarySaveDisabled?: boolean;
  onAiRequest: () => void;
  isAiRequestLoading?: boolean;
  aiRequestDisabled?: boolean;
  onSaveDesign?: () => void;
  saveDesignLabel?: string;
  saveDesignDisabled?: boolean;
  showSaveDesign?: boolean;
  notices?: ReactNode;
  children?: ReactNode;
};

type ProductionEditorActionButtonsProps = {
  isEdit: boolean;
  onTemporarySave?: () => void;
  temporarySaveLabel?: string;
  temporarySaveDisabled?: boolean;
  onAiRequest: () => void;
  aiRequestLabel: string;
  aiRequestLoadingLabel: string;
  isAiRequestLoading?: boolean;
  aiRequestDisabled?: boolean;
  onSaveDesign?: () => void;
  saveDesignLabel?: string;
  saveDesignDisabled?: boolean;
  showSaveDesign?: boolean;
};

type ProductionPromptCardProps = {
  value: string;
  onChange: (value: string) => void;
};

type ProductionCandidateCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ProductionHeaderCard({ backLabel, eyebrow, description, onBack }: ProductionHeaderCardProps) {
  return (
    <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
      {onBack && backLabel ? <button className="mb-4 text-xs font-black text-primary-strong" type="button" onClick={onBack}>← {backLabel}</button> : null}
      <p className="text-xs font-black text-primary-strong">{eyebrow}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-muted">{description}</p>
    </SoftCard>
  );
}

export function ProductionSizeCard({ title, description, value, options, onChange, sideValue, sideOptions, onSideChange }: ProductionSizeCardProps) {
  const showSideOptions = Boolean(sideValue && sideOptions?.length && onSideChange);

  return (
    <SoftCard>
      <p className="text-sm font-black text-ink">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-muted">{description}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select className="min-h-10 w-full rounded-md border border-line bg-white px-3 text-xs font-bold text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        {showSideOptions ? (
          <select className="min-h-10 w-full rounded-md border border-line bg-white px-3 text-xs font-bold text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" value={sideValue} onChange={(event) => onSideChange?.(event.target.value)}>
            {sideOptions?.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        ) : null}
      </div>
    </SoftCard>
  );
}

export function ProductionRequestCard({ title, description, requestLabel, requestPlaceholder, requestValue, onRequestChange, primaryLabel, primaryLoadingLabel, isPrimaryLoading, primaryDisabled, onPrimary, secondaryActions, children, notices }: ProductionRequestCardProps) {
  return (
    <SoftCard>
      <p className="text-sm font-black text-ink">{title}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-muted">{description}</p>
      <div className="mt-4 grid min-w-0 gap-2">
        {requestLabel && onRequestChange ? <TextAreaField label={requestLabel} placeholder={requestPlaceholder ?? ""} value={requestValue ?? ""} onChange={onRequestChange} /> : null}
        {secondaryActions}
        <AppButton onClick={onPrimary} disabled={primaryDisabled} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
          {isPrimaryLoading ? primaryLoadingLabel ?? primaryLabel : primaryLabel}
        </AppButton>
        {children}
      </div>
      {notices}
    </SoftCard>
  );
}

function ProductionEditorActionButtons({ isEdit, onTemporarySave, temporarySaveLabel = "저장하기", temporarySaveDisabled, onAiRequest, aiRequestLabel, aiRequestLoadingLabel, isAiRequestLoading, aiRequestDisabled, onSaveDesign, saveDesignLabel = "저장하기", saveDesignDisabled, showSaveDesign }: ProductionEditorActionButtonsProps) {
  const showTemporarySave = !isEdit && Boolean(onTemporarySave) && !showSaveDesign;

  return (
    <>
      {showTemporarySave ? <AppButton variant="secondary" onClick={onTemporarySave} disabled={temporarySaveDisabled} className="py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">{temporarySaveLabel}</AppButton> : null}
      <AppButton onClick={onAiRequest} disabled={aiRequestDisabled} className="py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
        {isAiRequestLoading ? aiRequestLoadingLabel : aiRequestLabel}
      </AppButton>
      {showSaveDesign && onSaveDesign ? <AppButton onClick={onSaveDesign} disabled={saveDesignDisabled} className="py-3 text-xs disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">{saveDesignLabel}</AppButton> : null}
    </>
  );
}

export function ProductionAiDesignRequestCard({ mode, title, description, promptValue, promptPlaceholder, onPromptChange, onTemporarySave, temporarySaveLabel, temporarySaveDisabled, onAiRequest, isAiRequestLoading, aiRequestDisabled, onSaveDesign, saveDesignLabel, saveDesignDisabled, showSaveDesign, notices, children }: ProductionAiDesignRequestCardProps) {
  const isEdit = mode === "edit";
  const aiRequestLabel = isEdit ? "AI 디자인 수정요청" : "AI 디자인 요청하기";
  const aiRequestLoadingLabel = isEdit ? "AI 디자인 수정 중" : "디자인 요청 중";

  return (
    <SoftCard>
      <p className="text-sm font-black text-ink">{title ?? (isEdit ? "AI 디자인 수정" : "AI 디자인 요청")}</p>
      {description ? <p className="mt-2 text-xs font-bold leading-5 text-muted">{description}</p> : null}
      <div className="mt-4 grid gap-2">
        <TextAreaField label="프롬프트" placeholder={promptPlaceholder} value={promptValue} onChange={onPromptChange} />
        {children}
        <ProductionEditorActionButtons isEdit={isEdit} onTemporarySave={onTemporarySave} temporarySaveLabel={temporarySaveLabel} temporarySaveDisabled={temporarySaveDisabled} onAiRequest={onAiRequest} aiRequestLabel={aiRequestLabel} aiRequestLoadingLabel={aiRequestLoadingLabel} isAiRequestLoading={isAiRequestLoading} aiRequestDisabled={aiRequestDisabled} onSaveDesign={onSaveDesign} saveDesignLabel={saveDesignLabel} saveDesignDisabled={saveDesignDisabled} showSaveDesign={showSaveDesign} />
      </div>
      {notices}
    </SoftCard>
  );
}

export function ProductionPromptCard({ value, onChange }: ProductionPromptCardProps) {
  if (!value) {
    return null;
  }

  return (
    <SoftCard>
      <TextAreaField label="AI에 전송할 최종 프롬프트" value={value} placeholder="AI에 보낼 최종 프롬프트" onChange={onChange} />
      <p className="mt-2 text-xs font-bold leading-5 text-muted">이 내용을 직접 수정한 뒤 전송할 수 있어요. 전송하기를 누를 때 이 프롬프트 그대로 AI에 전달됩니다.</p>
    </SoftCard>
  );
}

export function ProductionCandidateCard({ title, description, children }: ProductionCandidateCardProps) {
  return (
    <div className="grid gap-3">
      <p className="text-xs font-black text-primary-strong">{title}</p>
      {description ? <p className="text-xs font-bold leading-5 text-muted">{description}</p> : null}
      {children}
    </div>
  );
}
