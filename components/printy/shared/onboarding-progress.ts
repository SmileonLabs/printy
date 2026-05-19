import type { OnboardingStep } from "@/lib/types";

export const stepNumbers: Record<OnboardingStep, number> = {
  home: 0,
  brandCreation: 1,
  logoDirection: 2,
  logoUpload: 2,
  generating: 3,
  logoSelection: 4,
  logoSave: 5,
  logoRevision: 4,
  memberInput: 6,
  businessCardPreview: 7,
  orderOptions: 8,
  login: 9,
  checkout: 10,
  success: 11,
};

export const onboardingTotalSteps = 11;
