"use client";

import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { resolveBusinessCardTemplate } from "@/lib/business-card-templates";
import type { Member } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

function selectedMembersFromState(members: Member[], selectedMemberIds: string[], fallback: Member) {
  const selectedMembers = selectedMemberIds.map((memberId) => members.find((member) => member.id === memberId)).filter((member): member is Member => Boolean(member));

  return selectedMembers.length > 0 ? selectedMembers : [fallback];
}

export function BusinessCardBatchPreviewScreen() {
  const { brands, selectedBrandId, brandDraft, memberDraft, selectedBusinessCardMemberIds, selectedLogoId, businessCardDrafts, activeBusinessCardDraftId, selectedTemplateId, setStep } = usePrintyStore();
  const logo = usePrintyStore((state) => resolveLogoFromState(state, selectedLogoId));
  const activeDraft = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId);
  const template = usePrintyStore((state) => resolveBusinessCardTemplate(state.templates, activeDraft?.templateId ?? selectedTemplateId));
  const brand = brands.find((item) => item.id === selectedBrandId);
  const members = selectedMembersFromState(brand?.members ?? [], selectedBusinessCardMemberIds, memberDraft);

  return (
    <Screen footer={<AppButton onClick={() => setStep("orderOptions")} disabled={!template} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">수량과 용지 선택하기</AppButton>}>
      <ProgressHeader eyebrow="명함 대상 확인" title="선택한 팀원 명함을 확인해요" description="선택한 팀원마다 같은 디자인으로 명함이 제작됩니다." step={stepNumbers.businessCardBatchPreview} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {!template ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">선택된 명함 템플릿이 없어요.</p>
        </SoftCard>
      ) : (
        <div className="grid gap-5">
          {members.map((member) => (
            <SoftCard key={member.id || member.name}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-primary-strong">제작 대상</p>
                  <h2 className="mt-1 text-lg font-black tracking-[-0.04em] text-ink">{member.name}</h2>
                  <p className="mt-1 text-xs font-bold text-muted">{member.role || brandDraft.category}</p>
                </div>
                <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{template.title}</span>
              </div>
              <div className="grid gap-3">
                <BusinessCardPreview brandName={brandDraft.name} category={brandDraft.category} member={member} logo={logo} template={template} side="front" />
                {template.layout ? <BusinessCardPreview brandName={brandDraft.name} category={brandDraft.category} member={member} logo={logo} template={template} side="back" /> : null}
              </div>
            </SoftCard>
          ))}
        </div>
      )}
    </Screen>
  );
}
