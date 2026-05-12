"use client";

import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { ProgressHeader, Screen } from "@/components/ui";
import { PrintyBrandLogo } from "@/components/ui/logo";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

export function LogoGeneratingScreen() {
  const brandDraft = usePrintyStore((state) => state.brandDraft);
  const logoGenerationMessage = usePrintyStore((state) => state.logoGenerationMessage);
  const logoGenerationIntent = usePrintyStore((state) => state.logoGenerationIntent);
  const isRevision = logoGenerationIntent === "revision";
  const progressCopy = isRevision ? logoUiCopy.revisionGeneration : logoUiCopy.initialGeneration;

  return (
    <Screen>
      <div className="flex min-h-full flex-col py-6">
        <ProgressHeader eyebrow={isRevision ? "AI 로고 수정" : "AI 로고 생성"} title={progressCopy.title} description={isRevision ? logoUiCopy.revisionGeneration.description(brandDraft.name) : logoUiCopy.initialGeneration.description(brandDraft.name, brandDraft.category)} step={stepNumbers.generating} total={onboardingTotalSteps} action={<HomeExitAction />} />
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
            <div className="mt-8 flex justify-center gap-2">
              {progressCopy.labels.map((label, index) => (
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
