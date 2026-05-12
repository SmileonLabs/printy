"use client";

import Image from "next/image";
import { LogoGenerationFailure } from "@/components/printy/logo/logo-generation-failure";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function LogoSelectionScreen() {
  const { selectedLogoId, generatedLogoOptions, logoGenerationStatus, logoGenerationMessage, logoGenerationTargetBrandId, selectLogo, startLogoRevision, setStep } = usePrintyStore();
  const hasGeneratedLogos = generatedLogoOptions.length > 0;
  const isFailure = logoGenerationStatus === "error" && !hasGeneratedLogos;
  const selectedGeneratedLogo = generatedLogoOptions.find((logo) => logo.id === selectedLogoId && logo.source === "openai");
  const canReviseSelectedLogo = hasGeneratedLogos && selectedGeneratedLogo !== undefined;

  return (
    <Screen
      footer={
        hasGeneratedLogos ? (
          <div className="grid gap-3">
            <AppButton onClick={() => setStep("logoSave")}>{logoGenerationTargetBrandId ? "로고 하나 더 추가" : "브랜드 생성"}</AppButton>
            {canReviseSelectedLogo ? (
              <AppButton variant="secondary" onClick={() => startLogoRevision(selectedGeneratedLogo.id)}>
                이 로고 수정하기
              </AppButton>
            ) : null}
          </div>
        ) : undefined
      }
    >
      <ProgressHeader eyebrow="로고 선택" title={isFailure ? "로고 생성이 멈췄어요" : "마음에 드는 해석을 골라주세요"} description={isFailure ? "대체 로고나 기본 카드 대신 실패 상태를 보여드려요. 요청을 수정하거나 같은 조건으로 다시 생성할 수 있어요." : "브랜드 정보를 바탕으로 만든 로고예요. 선택하면 명함과 홍보물에 적용돼요."} step={stepNumbers.logoSelection} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {isFailure ? (
        <LogoGenerationFailure message={logoGenerationMessage} onRetry={() => setStep("generating")} onEdit={() => setStep("logoDirection")} />
      ) : null}
      {hasGeneratedLogos ? (
        <>
      <SoftCard className="mb-4 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-primary-strong">생성 완료</p>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-xs font-black text-primary-strong shadow-soft">{generatedLogoOptions.length}</span>
        </div>
      </SoftCard>
      <div className="grid gap-4">
        {generatedLogoOptions.map((logo) => (
          <button
            key={logo.id}
            className={`rounded-lg border bg-surface p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 ${selectedLogoId === logo.id ? "border-primary ring-4 ring-primary-soft" : "border-line"}`}
            type="button"
            onClick={() => selectLogo(logo.id)}
          >
            <div className="grid gap-4">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-md bg-[linear-gradient(135deg,var(--color-surface-blue)_0%,var(--color-surface)_100%)] p-4">
                <Image src={logo.imageUrl} alt={logo.name} width={320} height={320} className="h-full w-full object-contain" unoptimized />
              </div>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-lg font-black leading-6 text-ink">{logo.label}</p>
                  <span className="rounded-sm bg-surface-blue px-2 py-1 text-[10px] font-black text-primary-strong">{logo.planSource === "user" ? "요청" : "자동"}</span>
                </div>
                <p className="mt-2 text-xs font-bold leading-5 text-primary-strong">방향: {logo.lens ?? logo.label}</p>
                <p className="mt-2 text-xs font-bold leading-5 text-muted">요청: {logo.requestSummary ?? logo.designRequest ?? logo.description}</p>
                <p className="mt-3 text-xs font-medium leading-5 text-muted">{logo.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
        </>
      ) : null}
    </Screen>
  );
}
