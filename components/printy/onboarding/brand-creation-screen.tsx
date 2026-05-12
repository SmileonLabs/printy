"use client";

import { IndustrySelector } from "@/components/printy/onboarding/selectors";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard, TextField } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";
import { HomeExitAction } from "./home-exit-action";

export function BrandCreationScreen() {
  const { brandDraft, updateBrandDraft, setStep } = usePrintyStore();
  const canContinue = brandDraft.name.trim().length > 0 && brandDraft.category.trim().length > 0;

  return (
    <Screen footer={<AppButton onClick={() => setStep("logoDirection")} disabled={!canContinue} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">다음 단계로</AppButton>}>
      <ProgressHeader eyebrow="브랜드 기본" title="브랜드를 소개해 주세요" description="브랜드 이름과 업종은 모든 로고 시안에서 바뀌지 않는 핵심 정보예요. 정확한 이름과 업종을 먼저 알려주세요." step={stepNumbers.brandCreation} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <div className="grid gap-5">
        <TextField label="브랜드 이름" placeholder="예: 프린티 스튜디오" value={brandDraft.name} onChange={(value) => updateBrandDraft("name", value)} />
        <IndustrySelector selected={brandDraft.category} onSelect={(value) => updateBrandDraft("category", value)} />
      </div>
    </Screen>
  );
}
