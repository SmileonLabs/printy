"use client";

import { useState } from "react";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { getBusinessCardTemplateOrientation, isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import type { Member, PrintTemplate, ResolvedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type DownloadState = {
  templateId?: string;
  error?: string;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function readApiErrorReason(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "reason" in value && typeof value.reason === "string" ? value.reason : fallback;
}

function readDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return asciiMatch?.[1] ?? fallback;
}

export function BusinessCardPreviewScreen() {
  const { brandDraft, memberDraft, selectedLogoId, selectedTemplateId, businessCardDrafts, activeBusinessCardDraftId, templates, selectTemplate, setStep } = usePrintyStore();
  const logo = usePrintyStore((state) => resolveLogoFromState(state, selectedLogoId));
  const [downloadState, setDownloadState] = useState<DownloadState>({});
  const [expandedTemplateId, setExpandedTemplateId] = useState<string>();
  const activeDraft = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId);
  const currentTemplateId = activeDraft?.templateId ?? selectedTemplateId;
  const adminLayoutTemplates = templates.filter((candidate) => isPublishedBusinessCardTemplate(candidate) && candidate.layout);

  const handleOrder = (templateId: string) => {
    selectTemplate(templateId);
    setStep("businessCardBatchPreview");
  };

  const handleDownloadPdf = async (template: PrintTemplate) => {
    setDownloadState({ templateId: template.id });

    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(template.id)}/business-card-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brandDraft.name, category: brandDraft.category, member: memberDraft, logo }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => undefined);

        throw new Error(readApiErrorReason(data, "PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요."));
      }

      const blob = await response.blob();
      downloadBlob(blob, readDownloadFileName(response, `${template.title}.pdf`));
      setDownloadState({});
    } catch (error) {
      setDownloadState({ error: error instanceof Error ? error.message : "PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요." });
    }
  };

  return (
    <Screen>
      <ProgressHeader eyebrow="명함 미리보기" title="첫 명함 시안이 준비됐어요" description="복잡한 편집 없이 로고와 구성원 정보가 가장 잘 보이는 안전한 인쇄 레이아웃으로 맞췄어요." step={stepNumbers.businessCardPreview} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {adminLayoutTemplates.length === 0 ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">주문 가능한 관리자 명함 템플릿이 아직 없어요.</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">관리자에서 명함 템플릿을 공개 상태로 저장하면 이 화면에 표시돼요.</p>
        </SoftCard>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
          {adminLayoutTemplates.map((candidate) => (
            <TemplatePreviewCard key={candidate.id} template={candidate} selected={currentTemplateId === candidate.id} brandName={brandDraft.name} category={brandDraft.category} member={memberDraft} logo={logo} onOpen={() => setExpandedTemplateId(candidate.id)} />
          ))}
        </div>
      )}
      {expandedTemplateId ? (
        <TemplatePreviewDialog template={adminLayoutTemplates.find((template) => template.id === expandedTemplateId)} brandName={brandDraft.name} category={brandDraft.category} member={memberDraft} logo={logo} downloading={downloadState.templateId === expandedTemplateId} downloadError={downloadState.error} onClose={() => setExpandedTemplateId(undefined)} onOrder={(templateId) => handleOrder(templateId)} onDownload={(template) => handleDownloadPdf(template)} />
      ) : null}
    </Screen>
  );
}

function TemplatePreviewCard({ template, selected, brandName, category, member, logo, onOpen }: { template: PrintTemplate; selected: boolean; brandName: string; category: string; member: Member; logo: ResolvedLogoOption; onOpen: () => void }) {
  const orientation = getBusinessCardTemplateOrientation(template);
  const orientationLabel = orientation === "horizontal" ? "가로형" : "세로형";

  return (
    <button className={`rounded-lg border bg-surface p-2 text-left shadow-card transition hover:-translate-y-0.5 ${selected ? "border-primary ring-4 ring-primary-soft" : "border-line"}`} type="button" onClick={onOpen}>
      <span className="mb-2 inline-flex rounded-md bg-surface-blue px-2 py-1 text-[10px] font-black text-primary-strong">{orientationLabel}</span>
      <div className="grid gap-2">
        <BusinessCardPreview brandName={brandName} category={category} member={member} logo={logo} template={template} side="front" />
      </div>
      <span className="mt-3 block text-sm font-medium tracking-[-0.03em] text-muted">{template.title}</span>
    </button>
  );
}

function TemplatePreviewDialog({ template, brandName, category, member, logo, downloading, downloadError, onClose, onOrder, onDownload }: { template?: PrintTemplate; brandName: string; category: string; member: Member; logo: ResolvedLogoOption; downloading: boolean; downloadError?: string; onClose: () => void; onOrder: (templateId: string) => void; onDownload: (template: PrintTemplate) => void }) {
  if (!template) {
    return null;
  }

  const orientation = getBusinessCardTemplateOrientation(template);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-surface p-4 shadow-floating">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-primary-strong">{orientation === "horizontal" ? "가로형" : "세로형"} 템플릿</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">{template.title}</h2>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">{template.summary}</p>
          </div>
          <button className="rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong" type="button" onClick={onClose}>닫기</button>
        </div>
        <div className="grid gap-3">
          <BusinessCardPreview brandName={brandName} category={category} member={member} logo={logo} template={template} side="front" />
          <BusinessCardPreview brandName={brandName} category={category} member={member} logo={logo} template={template} side="back" />
        </div>
        <div className="mt-4 grid gap-2">
          <AppButton onClick={() => onOrder(template.id)}>이 디자인으로 주문하기</AppButton>
          <AppButton variant="secondary" onClick={() => onDownload(template)} disabled={downloading} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {downloading ? "PDF 준비 중" : "PDF 다운 받기"}
          </AppButton>
          {downloadError ? <p className="rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{downloadError}</p> : null}
        </div>
      </div>
    </div>
  );
}
