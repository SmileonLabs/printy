"use client";

import { IconBackButton } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function ShellBackButton() {
  const onboardingComplete = usePrintyStore((state) => state.onboardingComplete);
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const currentStep = usePrintyStore((state) => state.currentStep);
  const activeTab = usePrintyStore((state) => state.activeTab);
  const brandView = usePrintyStore((state) => state.brandView);
  const goBack = usePrintyStore((state) => state.goBack);

  const isDashboardRoot = onboardingComplete && isAuthenticated && activeTab === "home" && brandView === "list";
  const isHomeRoot = !onboardingComplete && currentStep === "home";

  if (isDashboardRoot || isHomeRoot) {
    return null;
  }

  return <IconBackButton onClick={goBack} />;
}
