import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logoOptions, seedPrintProducts } from "@/lib/mock-data";
import { defaultBrandDraft, defaultMember, defaultOrderOptions, defaultPaymentMethod } from "@/store/printy-store-defaults";
import { createPrintyCatalogActions } from "@/store/printy-store-catalog-actions";
import { createPrintyDraftActions } from "@/store/printy-store-draft-actions";
import { createPrintyLogoActions } from "@/store/printy-store-logo-actions";
import { createPrintyNavigationActions } from "@/store/printy-store-navigation-actions";
import { createPrintyOnboardingActions } from "@/store/printy-store-onboarding-actions";
import { getOrderPrice } from "@/store/printy-store-order";
import { printyStorePersistOptions } from "@/store/printy-store-persistence";
import { createPrintySessionActions } from "@/store/printy-store-session-actions";
import { createPrintyTemplateActions } from "@/store/printy-store-template-actions";
import { createPrintyWorkspaceActions } from "@/store/printy-store-workspace-actions";
import type { PrintyState } from "@/store/printy-store-types";

export { getOrderPrice };

export const usePrintyStore = create<PrintyState>()(
  persist(
    (set, get) => ({
      currentStep: "home",
      onboardingComplete: false,
      activeTab: "home",
      brandView: "list",
      activeBrandSection: "style",
      brandDraft: defaultBrandDraft,
      memberDraft: defaultMember,
      selectedLogoId: logoOptions[0].id,
      generatedLogoOptions: [],
      savedGeneratedLogoOptions: [],
      logoGenerationStatus: "idle",
      logoGenerationMessage: undefined,
      logoGenerationMode: "manual",
      selectedLogoReferenceImageId: undefined,
      logoGenerationTargetBrandId: undefined,
      logoGenerationIntent: "initial",
      logoRevisionRequest: "",
      logoRevisionSourceLogoId: undefined,
      orderOptions: defaultOrderOptions,
      selectedPaymentMethod: defaultPaymentMethod,
      isAuthenticated: false,
      users: [],
      authSession: undefined,
      selectedBrandId: undefined,
      activeBusinessCardDraftId: undefined,
      lastOrderId: undefined,
      brands: [],
      businessCardDrafts: [],
      orders: [],
      printProducts: seedPrintProducts,
      templates: [],
      brandAssets: [],
      selectedProductId: undefined,
      selectedTemplateId: undefined,
      selectedBusinessCardMemberIds: [],
      loginRedirectTarget: undefined,
      loginBackStep: undefined,
      brandWorkspaceHasPendingLocalChanges: false,
      brandWorkspaceOwnerUserId: undefined,
      ...createPrintyDraftActions(set),
      ...createPrintyLogoActions(set, get),
      ...createPrintyNavigationActions(set, get),
      ...createPrintySessionActions(set, get),
      ...createPrintyOnboardingActions(set, get),
      ...createPrintyCatalogActions(set, get),
      ...createPrintyTemplateActions(set),
      ...createPrintyWorkspaceActions(set),
    }),
    printyStorePersistOptions,
  ),
);
