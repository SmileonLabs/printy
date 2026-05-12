"use client";

import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { LogoMark } from "@/components/ui/logo";
import { usePrintyStore } from "@/store/use-printy-store";

export function LogoSaveScreen() {
  const { brandDraft, selectedLogoId, logoGenerationTargetBrandId, isAuthenticated, saveBrandShell, enterDashboard, setStep } = usePrintyStore();
  const logo = usePrintyStore((state) => resolveLogoFromState(state, selectedLogoId));

  const handleSaveLogo = () => {
    saveBrandShell();

    if (isAuthenticated) {
      enterDashboard();
      return;
    }

    setStep("login");
  };

  return (
    <Screen footer={<AppButton onClick={handleSaveLogo}>{logoGenerationTargetBrandId ? "로고 하나 더 추가" : "로고 저장하기"}</AppButton>}>
      <ProgressHeader eyebrow={logoGenerationTargetBrandId ? "로고 추가" : "브랜드 생성"} title={logoGenerationTargetBrandId ? "선택한 로고를 목록에 추가해요" : "선택한 로고를 브랜드에 저장해요"} description={logoGenerationTargetBrandId ? "기존 로고는 유지되고, 새 로고가 브랜드의 저장된 로고 목록에 추가됩니다." : "주문이나 명함 시안 없이 브랜드 공간만 먼저 만들어요. 저장 후 My Brand에서 명함 제작을 이어갈 수 있어요."} step={stepNumbers.logoSave} total={onboardingTotalSteps} action={<HomeExitAction />} titleClassName="whitespace-nowrap text-[clamp(1.55rem,6.2vw,1.875rem)]" />
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <div className="grid justify-items-center gap-5 py-3 text-center">
          <LogoMark logo={logo} size="xl" />
          <div>
            <p className="text-xs font-black text-primary-strong">저장될 브랜드</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-ink">{brandDraft.name}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">{brandDraft.category} · 로고 파일 보관 준비 완료</p>
          </div>
        </div>
      </SoftCard>
    </Screen>
  );
}
