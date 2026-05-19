"use client";

import { type ReactElement } from "react";
import { BrandMockupJobController } from "@/components/printy/brand-mockup-job-controller";
import { IconButton } from "@/components/printy/dashboard/brands-tab";
import { BrandWorkspaceSyncController } from "@/components/printy/brand-workspace-sync-controller";
import { MainApp } from "@/components/printy/dashboard/main-app";
import { LogoGenerationController } from "@/components/printy/logo/logo-generation-controller";
import { LogoShareClaimController } from "@/components/printy/logo-share-claim-controller";
import { LogoGeneratingScreen } from "@/components/printy/logo/logo-generating-screen";
import { LogoRevisionScreen } from "@/components/printy/logo/logo-revision-screen";
import { LogoSaveScreen } from "@/components/printy/logo/logo-save-screen";
import { LogoSelectionScreen } from "@/components/printy/logo/logo-selection-screen";
import { LogoUploadScreen } from "@/components/printy/logo/logo-upload-screen";
import { BrandCreationScreen } from "@/components/printy/onboarding/brand-creation-screen";
import { BusinessCardPreviewScreen } from "@/components/printy/onboarding/business-card-preview-screen";
import { CheckoutScreen } from "@/components/printy/onboarding/checkout-screen";
import { HomeScreen } from "@/components/printy/onboarding/home-screen";
import { LoginScreen } from "@/components/printy/onboarding/login-screen";
import { LogoDirectionScreen } from "@/components/printy/onboarding/logo-direction-screen";
import { MemberInputScreen } from "@/components/printy/onboarding/member-input-screen";
import { OrderOptionsScreen } from "@/components/printy/onboarding/order-options-screen";
import { ShellBackButton } from "@/components/printy/shared/shell-back-button";
import { SuccessScreen } from "@/components/printy/onboarding/success-screen";
import { SessionSyncController } from "@/components/printy/session-sync-controller";
import type { OnboardingStep } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";
import { PhoneShell } from "@/components/ui";

export function PrintyApp() {
  const onboardingComplete = usePrintyStore((state) => state.onboardingComplete);
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const currentStep = usePrintyStore((state) => state.currentStep);
  const startNewBrand = usePrintyStore((state) => state.startNewBrand);
  const openNotifications = usePrintyStore((state) => state.openNotifications);
  const setStep = usePrintyStore((state) => state.setStep);
  const enterDashboard = usePrintyStore((state) => state.enterDashboard);
  const activityCount = usePrintyStore((state) => state.orders.length + state.brands.length + state.businessCardDrafts.length + (state.aiBusinessCardMockupStatus === "idle" ? 0 : 1));
  const showDashboardTopActions = onboardingComplete && isAuthenticated;
  const handleLogoClick = () => {
    if (isAuthenticated) {
      enterDashboard();
      return;
    }

    setStep("home");
  };

  return (
    <>
      <LogoGenerationController />
      <BrandMockupJobController />
      <LogoShareClaimController />
      <SessionSyncController />
      <BrandWorkspaceSyncController />
      <PhoneShell
        topLeftAction={<ShellBackButton />}
        topRightAction={
          showDashboardTopActions ? (
            <div className="flex items-center gap-2">
              <IconButton label={`활동 알림 보기${activityCount > 0 ? ` ${activityCount}개` : ""}`} icon="notification" onClick={openNotifications} />
              <IconButton label="새 브랜드 만들기" icon="plus" onClick={startNewBrand} />
            </div>
          ) : undefined
        }
        onLogoClick={handleLogoClick}
      >
        <GlobalLogoGenerationNotice />
        <GlobalBrandMockupNotice />
        <GlobalAiBusinessCardMockupNotice />
        <GlobalAiBusinessCardPdfNotice />
        {onboardingComplete && isAuthenticated ? <MainApp /> : <OnboardingFlow step={currentStep} />}
      </PhoneShell>
    </>
  );
}

function GlobalLogoGenerationNotice() {
  const notice = usePrintyStore((state) => state.backgroundLogoGenerationNotice);
  const beginBackgroundLogoGeneration = usePrintyStore((state) => state.beginBackgroundLogoGeneration);
  const dismissBackgroundLogoGenerationNotice = usePrintyStore((state) => state.dismissBackgroundLogoGenerationNotice);
  const openGeneratedLogos = usePrintyStore((state) => state.openBackgroundGeneratedLogos);
  const setActiveLogoGenerationJob = usePrintyStore((state) => state.setActiveLogoGenerationJob);
  const setStep = usePrintyStore((state) => state.setStep);

  if (!notice) {
    return null;
  }

  const handleRetry = () => {
    const brandId = notice.brandId;

    setStep("logoDirection");
    window.setTimeout(() => {
      setActiveLogoGenerationJob(undefined);
      beginBackgroundLogoGeneration(brandId, "로고를 다시 만들고 있어요.");
      setStep("generating");
    }, 0);
  };

  return (
    <div className="shrink-0 px-5 pb-2">
      <div className="rounded-lg border border-primary-soft bg-surface-blue px-4 py-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black text-primary-strong">로고 생성</p>
            <p className="mt-1 text-xs font-black leading-5 text-ink">{notice.message}</p>
          </div>
          {notice.status === "generating" ? <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" /> : null}
        </div>
        {notice.status === "ready" ? (
          <button className="mt-2 rounded-md bg-primary px-3 py-2 text-xs font-black text-white shadow-soft" type="button" onClick={openGeneratedLogos}>
            완성 로고 확인하기
          </button>
        ) : null}
        {notice.status === "failed" ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="rounded-md bg-primary px-3 py-2 text-xs font-black text-white shadow-soft" type="button" onClick={handleRetry}>
              다시 시도하기
            </button>
            <button className="rounded-md bg-surface px-3 py-2 text-xs font-black text-primary-strong shadow-soft" type="button" onClick={dismissBackgroundLogoGenerationNotice}>
              취소하기
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GlobalAiBusinessCardPdfNotice() {
  const status = usePrintyStore((state) => state.aiBusinessCardPdfStatus);
  const message = usePrintyStore((state) => state.aiBusinessCardPdfMessage);
  const setStep = usePrintyStore((state) => state.setStep);
  const startCardEdit = usePrintyStore((state) => state.startCardEdit);
  const dismiss = usePrintyStore((state) => state.dismissAiBusinessCardPdfNotice);

  if (status === "idle" || !message) {
    return null;
  }

  const isGenerating = status === "generating";
  const isReady = status === "ready";
  const handleOpen = () => {
    startCardEdit();
    window.setTimeout(() => setStep("businessCardPreview"), 0);
    dismiss();
  };

  return (
    <div className="shrink-0 px-5 pb-2">
      <div className={`rounded-lg border px-4 py-3 shadow-card ${status === "failed" ? "border-danger bg-red-50" : "border-primary-soft bg-surface-blue"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] font-black ${status === "failed" ? "text-danger" : "text-primary-strong"}`}>명함 PDF</p>
            <p className="mt-1 text-xs font-black leading-5 text-ink">{message}</p>
          </div>
          {isGenerating ? <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" /> : null}
        </div>
        {isReady ? (
          <button className="mt-2 rounded-md bg-primary px-3 py-2 text-xs font-black text-white shadow-soft" type="button" onClick={handleOpen}>
            PDF 다운로드하러 가기
          </button>
        ) : null}
        {status === "failed" ? (
          <button className="mt-2 rounded-md bg-danger px-3 py-2 text-xs font-black text-white shadow-soft" type="button" onClick={dismiss}>
            닫기
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GlobalAiBusinessCardMockupNotice() {
  const status = usePrintyStore((state) => state.aiBusinessCardMockupStatus);
  const message = usePrintyStore((state) => state.aiBusinessCardMockupMessage);
  const setStep = usePrintyStore((state) => state.setStep);
  const startCardEdit = usePrintyStore((state) => state.startCardEdit);
  const dismissAiBusinessCardMockupNotice = usePrintyStore((state) => state.dismissAiBusinessCardMockupNotice);

  if (status === "idle" || !message) {
    return null;
  }

  const isGenerating = status === "generating";
  const isReady = status === "ready";
  const handleOpen = () => {
    startCardEdit();
    window.setTimeout(() => setStep("businessCardPreview"), 0);

    if (isReady) {
      dismissAiBusinessCardMockupNotice();
    }
  };

  return (
    <div className="shrink-0 px-5 pb-2">
      <div className={`rounded-lg border px-4 py-3 shadow-card ${status === "failed" ? "border-danger bg-red-50" : "border-primary-soft bg-surface-blue"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] font-black ${status === "failed" ? "text-danger" : "text-primary-strong"}`}>명함 목업</p>
            <p className="mt-1 text-xs font-black leading-5 text-ink">{message}</p>
          </div>
          {isGenerating ? <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" /> : null}
        </div>
        {isReady || status === "failed" ? (
          <button className={`mt-2 rounded-md px-3 py-2 text-xs font-black shadow-soft ${isReady ? "bg-primary text-white" : "bg-danger text-white"}`} type="button" onClick={handleOpen}>
            {isReady ? "완성 목업 보기" : "목업 상태 확인하기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GlobalBrandMockupNotice() {
  const job = usePrintyStore((state) => state.activeBrandMockupJob);
  const brand = usePrintyStore((state) => state.brands.find((item) => item.id === state.activeBrandMockupJob?.brandId));
  const enterDashboard = usePrintyStore((state) => state.enterDashboard);
  const openBrandDetail = usePrintyStore((state) => state.openBrandDetail);

  if (!job) {
    return null;
  }

  const isGenerating = job.status === "generating";
  const isReady = job.status === "ready";

  return (
    <div className="shrink-0 px-5 pb-2">
      <div className={`rounded-lg border px-4 py-3 shadow-card ${isGenerating || isReady ? "border-primary-soft bg-surface-blue" : "border-danger bg-red-50"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[11px] font-black ${isGenerating || isReady ? "text-primary-strong" : "text-danger"}`}>목업 생성</p>
            <p className="mt-1 text-xs font-black leading-5 text-ink">{brand?.name ? `${brand.name} · ${job.message}` : job.message}</p>
          </div>
          {isGenerating ? <span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" /> : null}
        </div>
        {isReady || job.status === "failed" ? (
          <button className={`mt-2 rounded-md px-3 py-2 text-xs font-black shadow-soft ${isReady ? "bg-primary text-white" : "bg-danger text-white"}`} type="button" onClick={() => { enterDashboard(); openBrandDetail(job.brandId); }}>
            {isReady ? "완성 목업 보기" : "목업 상태 확인하기"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OnboardingFlow({ step }: { step: OnboardingStep }) {
  const screens: Record<OnboardingStep, ReactElement> = {
    home: <HomeScreen />,
    brandCreation: <BrandCreationScreen />,
    logoDirection: <LogoDirectionScreen />,
    logoUpload: <LogoUploadScreen />,
    generating: <LogoGeneratingScreen />,
    logoSelection: <LogoSelectionScreen />,
    logoSave: <LogoSaveScreen />,
    logoRevision: <LogoRevisionScreen />,
    memberInput: <MemberInputScreen />,
    businessCardPreview: <BusinessCardPreviewScreen />,
    orderOptions: <OrderOptionsScreen />,
    login: <LoginScreen />,
    checkout: <CheckoutScreen />,
    success: <SuccessScreen />,
  };

  return screens[step];
}
