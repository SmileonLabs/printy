"use client";

import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen } from "@/components/ui";
import { PrintyBrandLogo } from "@/components/ui/logo";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

export function LogoGeneratingScreen() {
  const brandDraft = usePrintyStore((state) => state.brandDraft);
  const logoGenerationMessage = usePrintyStore((state) => state.logoGenerationMessage);
  const logoGenerationIntent = usePrintyStore((state) => state.logoGenerationIntent);
  const logoGenerationTargetBrandId = usePrintyStore((state) => state.logoGenerationTargetBrandId);
  const backgroundLogoGenerationNotice = usePrintyStore((state) => state.backgroundLogoGenerationNotice);
  const brands = usePrintyStore((state) => state.brands);
  const beginBackgroundLogoGeneration = usePrintyStore((state) => state.beginBackgroundLogoGeneration);
  const isRevision = logoGenerationIntent === "revision";
  const isUpload = logoGenerationIntent === "upload";
  const noticedBrandId = backgroundLogoGenerationNotice?.brandId;
  const backgroundBrandId = logoGenerationTargetBrandId ?? (noticedBrandId && brands.some((brand) => brand.id === noticedBrandId) ? noticedBrandId : undefined);
  const canLeaveInBackground = Boolean(backgroundBrandId);
  const progressCopy = isRevision ? logoUiCopy.revisionGeneration : logoUiCopy.initialGeneration;
  const title = isUpload ? "로고를 등록하고 있어요" : progressCopy.title;
  const description = isUpload ? `${brandDraft.name} 로고 이미지를 Printy 저장 형식에 맞게 정리하고 있어요.` : isRevision ? logoUiCopy.revisionGeneration.description(brandDraft.name) : logoUiCopy.initialGeneration.description(brandDraft.name, brandDraft.category);
  const labels = isUpload ? ["이미지 확인", "AI 정리", "PNG 저장"] : progressCopy.labels;

  const handleLeaveInBackground = () => {
    if (!backgroundBrandId) {
      return;
    }

    beginBackgroundLogoGeneration(backgroundBrandId, isUpload ? "올린 로고를 백그라운드에서 정리하고 있어요." : isRevision ? "로고 수정을 백그라운드에서 진행하고 있어요." : undefined);
  };

  return (
    <Screen>
      <div className="flex min-h-full flex-col py-6">
        <ProgressHeader eyebrow={isUpload ? "내 로고 등록" : isRevision ? "AI 로고 수정" : "AI 로고 생성"} title={title} description={description} step={stepNumbers.generating} total={onboardingTotalSteps} action={<HomeExitAction />} />
        <div className="flex flex-1 items-center justify-center text-center">
          <div className="w-full">
            <div className="relative mx-auto mb-8 h-36 w-36 rounded-full bg-surface-blue shadow-soft">
              <div className="loading-orbit absolute inset-4 rounded-full border-2 border-dashed border-primary" />
              <div className="absolute inset-10 grid place-items-center rounded-full bg-surface shadow-card">
                <PrintyBrandLogo size="sm" />
              </div>
            </div>
            {logoGenerationMessage ? <p className="mx-auto mt-4 w-fit rounded-md bg-surface-blue px-4 py-2 text-xs font-black text-primary-strong">{logoGenerationMessage}</p> : null}
            <div className="mx-auto mt-6 max-w-sm rounded-lg border border-line bg-surface p-4 text-left shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black text-primary-strong">생성 진행 중</span>
                <span className="text-[10px] font-black text-soft">LIVE</span>
              </div>
              <div className="logo-generation-track h-3 overflow-hidden rounded-sm bg-surface-blue">
                <span className="logo-generation-bar block h-full rounded-sm bg-primary" />
              </div>
            </div>
            {canLeaveInBackground ? (
              <div className="mx-auto mt-4 max-w-sm text-center">
                <p className="mb-3 text-xs font-bold leading-5 text-muted">홈으로 가도 작업은 계속 진행돼요. 완료되면 상단 알림에서 바로 확인할 수 있어요.</p>
                <AppButton variant="secondary" onClick={handleLeaveInBackground}>홈으로 가고 알림 받기</AppButton>
              </div>
            ) : null}
            <div className="mt-8 flex justify-center gap-2">
              {labels.map((label, index) => (
                <span key={label} className="pulse-dot rounded-md bg-surface-blue px-3 py-2 text-xs font-black text-primary-strong" style={{ animationDelay: `${index * 140}ms` }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
