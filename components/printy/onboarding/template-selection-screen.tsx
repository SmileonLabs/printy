"use client";

import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { BusinessCardTemplateRenderer } from "@/components/printy/templates/business-card-template-renderer";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { getBusinessCardTemplateOrientation, isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import type { Member, PrintTemplate, ResolvedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

export function TemplateSelectionScreen() {
  const { templates, businessCardDrafts, activeBusinessCardDraftId, selectedTemplateId, brandDraft, memberDraft, selectedLogoId, isAuthenticated, selectTemplate, setStep } = usePrintyStore();
  const logo = usePrintyStore((state) => resolveLogoFromState(state, selectedLogoId));
  const activeDraft = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId);
  const currentTemplateId = activeDraft?.templateId ?? selectedTemplateId;
  const businessCardTemplates = templates.filter(isPublishedBusinessCardTemplate);
  const selectedTemplate = businessCardTemplates.find((template) => template.id === currentTemplateId) ?? businessCardTemplates[0];
  const horizontalTemplates = businessCardTemplates.filter((template) => getBusinessCardTemplateOrientation(template) === "horizontal");
  const verticalTemplates = businessCardTemplates.filter((template) => getBusinessCardTemplateOrientation(template) === "vertical");

  const handleContinue = () => {
    if (selectedTemplate) {
      selectTemplate(selectedTemplate.id);
    }

    if (isAuthenticated) {
      setStep("checkout");
      return;
    }

    setStep("login", "checkout");
  };

  return (
    <Screen footer={<AppButton onClick={handleContinue} disabled={!selectedTemplate} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">다음으로</AppButton>}>
      <ProgressHeader eyebrow="템플릿 선택" title="명함의 첫인상을 골라주세요" description="가로형과 세로형 템플릿 중 브랜드에 맞는 구도를 선택하면 주문과 브랜드 상세 화면에 함께 저장돼요." step={stepNumbers.templateSelection} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {selectedTemplate ? (
        <SoftCard className="mb-5 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-primary-strong">선택한 템플릿</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">{selectedTemplate.title}</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-muted">{selectedTemplate.summary}</p>
            </div>
            <span className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-black text-white shadow-soft">
              {getBusinessCardTemplateOrientation(selectedTemplate) === "horizontal" ? "가로형" : "세로형"}
            </span>
          </div>
          <BusinessCardPreview brandName={brandDraft.name} category={brandDraft.category} member={memberDraft} logo={logo} template={selectedTemplate} />
        </SoftCard>
      ) : (
        <SoftCard className="mb-5">
          <p className="text-sm font-black text-ink">사용 가능한 명함 템플릿이 아직 없어요.</p>
        </SoftCard>
      )}
      <div className="grid gap-5">
        <TemplateGroup title="가로형 템플릿" templates={horizontalTemplates} selectedTemplateId={selectedTemplate?.id} brandName={brandDraft.name} category={brandDraft.category} member={memberDraft} logo={logo} onSelect={selectTemplate} />
        <TemplateGroup title="세로형 템플릿" templates={verticalTemplates} selectedTemplateId={selectedTemplate?.id} brandName={brandDraft.name} category={brandDraft.category} member={memberDraft} logo={logo} onSelect={selectTemplate} />
      </div>
    </Screen>
  );
}

function TemplateGroup({ title, templates, selectedTemplateId, brandName, category, member, logo, onSelect }: { title: string; templates: PrintTemplate[]; selectedTemplateId?: string; brandName: string; category: string; member: Member; logo: ResolvedLogoOption; onSelect: (templateId: string) => void }) {
  if (templates.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-black text-ink">{title}</h2>
      <div className="grid gap-3">
        {templates.map((template) => (
          <TemplateOptionCard key={template.id} template={template} selected={selectedTemplateId === template.id} brandName={brandName} category={category} member={member} logo={logo} onSelect={() => onSelect(template.id)} />
        ))}
      </div>
    </section>
  );
}

function TemplateOptionCard({ template, selected, brandName, category, member, logo, onSelect }: { template: PrintTemplate; selected: boolean; brandName: string; category: string; member: Member; logo: ResolvedLogoOption; onSelect: () => void }) {
  const orientation = getBusinessCardTemplateOrientation(template);

  return (
    <button className={`rounded-lg border p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 ${selected ? "border-primary bg-surface-blue ring-4 ring-primary-soft" : "border-line bg-surface hover:border-primary-soft hover:bg-surface-blue"}`} type="button" onClick={onSelect}>
      <div className="flex items-center gap-4">
        <MiniTemplatePreview template={template} brandName={brandName} category={category} member={member} logo={logo} />
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rounded-md bg-surface px-3 py-1 text-xs font-black text-primary-strong">{orientation === "horizontal" ? "가로형" : "세로형"}</span>
            <span className="text-xs font-black text-soft">{selected ? "선택됨" : template.createdAt}</span>
          </div>
          <p className="text-base font-black tracking-[-0.04em] text-ink">{template.title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">{template.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {template.tags.map((tag) => (
              <span key={tag} className="rounded-sm bg-primary-soft px-2 py-1 text-xs font-black text-primary-strong">#{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function MiniTemplatePreview({ template, brandName, category, member, logo }: { template: PrintTemplate; brandName: string; category: string; member: Member; logo: ResolvedLogoOption }) {
  const orientation = getBusinessCardTemplateOrientation(template);
  const isVertical = orientation === "vertical";

  if (template.layout) {
    return (
      <div className={`shrink-0 rounded-md bg-surface-blue p-2 shadow-soft ${isVertical ? "w-24" : "w-32"}`}>
        <BusinessCardTemplateRenderer brandName={brandName} category={category} member={member} logo={logo} layout={template.layout} side="front" chrome={false} />
      </div>
    );
  }

  return (
    <div className={`grid shrink-0 place-items-center rounded-md bg-surface-blue p-2 ${isVertical ? "h-32 w-24" : "h-24 w-32"}`}>
      <div className={`relative overflow-hidden rounded-sm border border-line bg-surface shadow-soft ${isVertical ? "h-28 w-16" : "h-16 w-28"}`}>
        <span className={`absolute rounded-full bg-primary ${isVertical ? "left-1/2 top-4 h-6 w-6 -translate-x-1/2" : "left-3 top-3 h-5 w-5"}`} />
        <span className={`absolute rounded-sm bg-line ${isVertical ? "bottom-10 left-1/2 h-2 w-10 -translate-x-1/2" : "bottom-5 left-3 h-2 w-14"}`} />
        <span className={`absolute rounded-sm bg-primary-soft ${isVertical ? "bottom-7 left-1/2 h-1.5 w-8 -translate-x-1/2" : "bottom-3 left-3 h-1.5 w-10"}`} />
      </div>
    </div>
  );
}
