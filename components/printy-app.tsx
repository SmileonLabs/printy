"use client";

import { type ReactElement } from "react";
import { BrandWorkspaceSyncController } from "@/components/printy/brand-workspace-sync-controller";
import { MainApp } from "@/components/printy/dashboard/main-app";
import { LogoGenerationController } from "@/components/printy/logo/logo-generation-controller";
import { LogoShareClaimController } from "@/components/printy/logo-share-claim-controller";
import { LogoGeneratingScreen } from "@/components/printy/logo/logo-generating-screen";
import { LogoRevisionScreen } from "@/components/printy/logo/logo-revision-screen";
import { LogoSaveScreen } from "@/components/printy/logo/logo-save-screen";
import { LogoSelectionScreen } from "@/components/printy/logo/logo-selection-screen";
import { BrandCreationScreen } from "@/components/printy/onboarding/brand-creation-screen";
import { BusinessCardPreviewScreen } from "@/components/printy/onboarding/business-card-preview-screen";
import { BusinessCardBatchPreviewScreen } from "@/components/printy/onboarding/business-card-batch-preview-screen";
import { CheckoutScreen } from "@/components/printy/onboarding/checkout-screen";
import { HomeScreen } from "@/components/printy/onboarding/home-screen";
import { LoginScreen } from "@/components/printy/onboarding/login-screen";
import { LogoDirectionScreen } from "@/components/printy/onboarding/logo-direction-screen";
import { MemberInputScreen } from "@/components/printy/onboarding/member-input-screen";
import { OrderOptionsScreen } from "@/components/printy/onboarding/order-options-screen";
import { ShellBackButton } from "@/components/printy/shared/shell-back-button";
import { SuccessScreen } from "@/components/printy/onboarding/success-screen";
import { TemplateSelectionScreen } from "@/components/printy/onboarding/template-selection-screen";
import { PublicTemplateSyncController } from "@/components/printy/templates/public-template-sync-controller";
import { SessionSyncController } from "@/components/printy/session-sync-controller";
import type { OnboardingStep } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";
import { PhoneShell } from "@/components/ui";

export function PrintyApp() {
  const onboardingComplete = usePrintyStore((state) => state.onboardingComplete);
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const currentStep = usePrintyStore((state) => state.currentStep);

  return (
    <>
      <LogoGenerationController />
      <LogoShareClaimController />
      <PublicTemplateSyncController />
      <SessionSyncController />
      <BrandWorkspaceSyncController />
      <PhoneShell topLeftAction={<ShellBackButton />}>{onboardingComplete && isAuthenticated ? <MainApp /> : <OnboardingFlow step={currentStep} />}</PhoneShell>
    </>
  );
}

function OnboardingFlow({ step }: { step: OnboardingStep }) {
  const screens: Record<OnboardingStep, ReactElement> = {
    home: <HomeScreen />,
    brandCreation: <BrandCreationScreen />,
    logoDirection: <LogoDirectionScreen />,
    generating: <LogoGeneratingScreen />,
    logoSelection: <LogoSelectionScreen />,
    logoSave: <LogoSaveScreen />,
    logoRevision: <LogoRevisionScreen />,
    memberInput: <MemberInputScreen />,
    businessCardPreview: <BusinessCardPreviewScreen />,
    businessCardBatchPreview: <BusinessCardBatchPreviewScreen />,
    orderOptions: <OrderOptionsScreen />,
    templateSelection: <TemplateSelectionScreen />,
    login: <LoginScreen />,
    checkout: <CheckoutScreen />,
    success: <SuccessScreen />,
  };

  return screens[step];
}
