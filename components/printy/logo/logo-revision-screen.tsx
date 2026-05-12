"use client";

import { LogoRevisionPanel } from "@/components/printy/logo/logo-revision-panel";
import { findGeneratedLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

export function LogoRevisionScreen() {
  const { generatedLogoOptions, savedGeneratedLogoOptions, logoRevisionRequest, logoRevisionSourceLogoId, updateLogoRevisionRequest, cancelLogoRevision, submitLogoRevision } = usePrintyStore();
  const revisionSourceLogo = logoRevisionSourceLogoId ? findGeneratedLogoFromState({ generatedLogoOptions, savedGeneratedLogoOptions }, logoRevisionSourceLogoId) : undefined;

  return (
    <Screen>
      <ProgressHeader eyebrow="로고 수정" title="선택한 로고를 기준으로 다듬기" description="마음에 든 시안의 정체성과 구도는 유지하고, 바꾸고 싶은 부분만 자연스럽게 적어주세요." step={stepNumbers.logoRevision} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {revisionSourceLogo ? (
        <LogoRevisionPanel logo={revisionSourceLogo} value={logoRevisionRequest} onChange={updateLogoRevisionRequest} onSubmit={submitLogoRevision} onCancel={cancelLogoRevision} />
      ) : (
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
          <p className="text-base font-black text-ink">{logoUiCopy.missingSourceLogo.title}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{logoUiCopy.missingSourceLogo.message}</p>
          <div className="mt-5">
            <AppButton onClick={cancelLogoRevision}>로고 다시 선택하기</AppButton>
          </div>
        </SoftCard>
      )}
    </Screen>
  );
}
