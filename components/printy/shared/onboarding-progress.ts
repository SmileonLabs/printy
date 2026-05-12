import type { OnboardingStep } from "@/lib/types";

export const stepNumbers: Record<OnboardingStep, number> = {
  home: 0,
  brandCreation: 1,
  logoDirection: 2,
  generating: 3,
  logoSelection: 4,
  logoSave: 5,
  logoRevision: 4,
  memberInput: 6,
  businessCardPreview: 7,
  businessCardBatchPreview: 8,
  orderOptions: 9,
  templateSelection: 9,
  login: 10,
  checkout: 11,
  success: 12,
};

export const onboardingTotalSteps = 12;
