import { createJSONStorage, type PersistOptions } from "zustand/middleware";
import { isSelectableLogoId, normalizeBrandDraft, normalizeBrandWithSelectableLogos, normalizeBusinessCardDraftWithSelectableLogos, normalizeGeneratedLogos, normalizeMember, normalizeSelectableLogoId } from "@/store/printy-store-normalizers";
import type { MainTab } from "@/lib/types";
import type { PrintyState } from "@/store/printy-store-types";

export const PRINTY_STORE_STORAGE_KEY = "printy-store";

export function isPersistedPrintyState(value: unknown): value is Partial<PrintyState> {
  return typeof value === "object" && value !== null;
}

export function hasSavedLocalWork(state: Partial<PrintyState>) {
  return Boolean(
    state.selectedBrandId ||
      state.activeBusinessCardDraftId ||
      state.lastOrderId ||
      (state.brands?.length ?? 0) > 0 ||
      (state.businessCardDrafts?.length ?? 0) > 0 ||
      (state.orders?.length ?? 0) > 0,
  );
}

function isMainTab(value: unknown): value is MainTab {
  switch (value) {
    case "home":
    case "brands":
    case "templates":
    case "orders":
    case "my":
      return true;
    default:
      return false;
  }
}

function hasSavedBrandWorkspaceArrays(state: Partial<PrintyState>) {
  return Boolean(
    (state.brands?.length ?? 0) > 0 ||
      (state.businessCardDrafts?.length ?? 0) > 0 ||
      (state.orders?.length ?? 0) > 0 ||
      (state.savedGeneratedLogoOptions?.length ?? 0) > 0,
  );
}

export function shouldPersistBrandWorkspaceArrays(state: Partial<PrintyState>) {
  const authUserId = state.authSession?.userId;

  if (!state.isAuthenticated || !authUserId) {
    return true;
  }

  if (state.brandWorkspaceOwnerUserId && state.brandWorkspaceOwnerUserId !== authUserId) {
    return false;
  }

  if (state.brandWorkspaceHasPendingLocalChanges) {
    return true;
  }

  return state.brandWorkspaceOwnerUserId === undefined && (hasSavedLocalWork(state) || hasSavedBrandWorkspaceArrays(state));
}

export function shouldShowHomeForPersistedGuest(state: Partial<PrintyState>) {
  return !state.isAuthenticated && !state.authSession && !hasSavedLocalWork(state) && (state.currentStep === undefined || state.currentStep === "brandCreation");
}

export const printyStorePersistOptions = {
  name: PRINTY_STORE_STORAGE_KEY,
  version: 1,
  storage: createJSONStorage<Partial<PrintyState>>(() => localStorage),
  migrate: (persistedState, version) => {
    if (!isPersistedPrintyState(persistedState)) {
      return {};
    }

    if (version >= 1) {
      return persistedState;
    }

    return {
      currentStep: "home",
      onboardingComplete: false,
      activeTab: "home",
      brandView: "list",
      activeBrandSection: "style",
      brandDraft: persistedState.brandDraft,
      logoGenerationMode: persistedState.logoGenerationMode,
      selectedLogoReferenceImageId: persistedState.selectedLogoReferenceImageId,
      orderOptions: persistedState.orderOptions,
      selectedPaymentMethod: persistedState.selectedPaymentMethod,
      users: [],
      authSession: undefined,
      isAuthenticated: false,
      savedGeneratedLogoOptions: [],
      brands: [],
      businessCardDrafts: [],
      orders: [],
      selectedLogoId: undefined,
      selectedBrandId: undefined,
      activeBusinessCardDraftId: undefined,
      lastOrderId: undefined,
      selectedBusinessCardMemberIds: [],
      brandWorkspaceHasPendingLocalChanges: false,
      brandWorkspaceOwnerUserId: undefined,
    } satisfies Partial<PrintyState>;
  },
  partialize: (state) => {
    const persistBrandWorkspaceArrays = shouldPersistBrandWorkspaceArrays(state);

    return {
      currentStep: state.currentStep,
      onboardingComplete: state.onboardingComplete,
      activeTab: state.activeTab,
      brandView: state.brandView,
      activeBrandSection: state.activeBrandSection,
      brandDraft: state.brandDraft,
      logoGenerationMode: state.logoGenerationMode,
      selectedLogoReferenceImageId: state.selectedLogoReferenceImageId,
      logoGenerationTargetBrandId: state.logoGenerationTargetBrandId,
      memberDraft: state.memberDraft,
      selectedLogoId: state.selectedLogoId,
      ...(persistBrandWorkspaceArrays
        ? {
            savedGeneratedLogoOptions: state.savedGeneratedLogoOptions.filter((logo) => logo.id === state.selectedLogoId || state.brands.some((brand) => brand.selectedLogoId === logo.id || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logo.id))) || state.businessCardDrafts.some((draft) => draft.selectedLogoId === logo.id)),
            brands: state.brands,
            businessCardDrafts: state.businessCardDrafts,
            orders: state.orders,
          }
        : {}),
      orderOptions: state.orderOptions,
      selectedPaymentMethod: state.selectedPaymentMethod,
      isAuthenticated: state.isAuthenticated,
      users: state.users,
      authSession: state.authSession,
      selectedBrandId: state.selectedBrandId,
      activeBusinessCardDraftId: state.activeBusinessCardDraftId,
      lastOrderId: state.lastOrderId,
      selectedTemplateId: state.selectedTemplateId,
      selectedBusinessCardMemberIds: state.selectedBusinessCardMemberIds,
      brandWorkspaceHasPendingLocalChanges: state.brandWorkspaceHasPendingLocalChanges,
      brandWorkspaceOwnerUserId: state.brandWorkspaceOwnerUserId,
    };
  },
  merge: (persistedState, currentState) => {
    if (!isPersistedPrintyState(persistedState)) {
      return currentState;
    }

    const persistedAuthUserId = persistedState.authSession?.userId;
    const persistedOwnerUserId = typeof persistedState.brandWorkspaceOwnerUserId === "string" ? persistedState.brandWorkspaceOwnerUserId : undefined;
    const shouldRestoreWorkspaceArrays = !persistedOwnerUserId || !persistedAuthUserId || persistedOwnerUserId === persistedAuthUserId;
    const persistedWorkspaceState = shouldRestoreWorkspaceArrays ? persistedState : currentState;
    const savedGeneratedLogoOptions = shouldRestoreWorkspaceArrays ? normalizeGeneratedLogos(persistedState.savedGeneratedLogoOptions) : currentState.savedGeneratedLogoOptions;
    const brands = (persistedWorkspaceState.brands ?? currentState.brands).filter((brand) => brand.id !== "brand-seed").map((brand) => normalizeBrandWithSelectableLogos(brand, savedGeneratedLogoOptions));
    const businessCardDrafts = (persistedWorkspaceState.businessCardDrafts ?? currentState.businessCardDrafts).map((draft) => normalizeBusinessCardDraftWithSelectableLogos(draft, savedGeneratedLogoOptions));
    const brandDraft = normalizeBrandDraft(persistedState.brandDraft, currentState.brandDraft);
    const memberDraft = normalizeMember(persistedState.memberDraft, currentState.memberDraft);
    const selectedBrandId = brands.some((brand) => brand.id === persistedState.selectedBrandId) ? persistedState.selectedBrandId : undefined;
    const activeBusinessCardDraftId = businessCardDrafts.some((draft) => draft.id === persistedState.activeBusinessCardDraftId) ? persistedState.activeBusinessCardDraftId : undefined;
    const selectedBrandLogoId = brands.find((brand) => brand.id === selectedBrandId)?.selectedLogoId;
    const activeDraftLogoId = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId)?.selectedLogoId;
    const currentStateLogoId = isSelectableLogoId(currentState.selectedLogoId, savedGeneratedLogoOptions) ? currentState.selectedLogoId : undefined;
    const fallbackLogoId = isSelectableLogoId(selectedBrandLogoId, savedGeneratedLogoOptions)
      ? selectedBrandLogoId
      : isSelectableLogoId(activeDraftLogoId, savedGeneratedLogoOptions)
        ? activeDraftLogoId
        : currentStateLogoId;
    const selectedLogoId = normalizeSelectableLogoId(persistedState.selectedLogoId, savedGeneratedLogoOptions, fallbackLogoId);
    const isAuthenticated = Boolean(persistedState.isAuthenticated && persistedState.authSession);
    const hasLegacyPersistedWorkspaceArrays = isAuthenticated && shouldRestoreWorkspaceArrays && persistedState.brandWorkspaceHasPendingLocalChanges === undefined && hasSavedBrandWorkspaceArrays(persistedState);
    const currentStep = shouldShowHomeForPersistedGuest(persistedState) ? "home" : persistedState.currentStep === "logoRevision" ? "logoSelection" : persistedState.currentStep === "templateSelection" ? "businessCardPreview" : persistedState.currentStep ?? currentState.currentStep;
    const persistedActiveTab = persistedState.activeTab === "notifications" ? "home" : persistedState.activeTab;
    const currentActiveTab = currentState.activeTab === "notifications" ? "home" : currentState.activeTab;
    const activeTab = isMainTab(persistedActiveTab) ? persistedActiveTab : isMainTab(currentActiveTab) ? currentActiveTab : "home";
    return {
      ...currentState,
      currentStep,
      onboardingComplete: isAuthenticated ? persistedState.onboardingComplete ?? currentState.onboardingComplete : false,
      activeTab,
      brandView: activeTab === "brands" && selectedBrandId && persistedState.brandView === "detail" ? "detail" : "list",
      activeBrandSection: persistedState.activeBrandSection ?? currentState.activeBrandSection,
      brandDraft,
      logoGenerationMode: persistedState.logoGenerationMode === "auto" || persistedState.logoGenerationMode === "reference" ? persistedState.logoGenerationMode : currentState.logoGenerationMode,
      selectedLogoReferenceImageId: typeof persistedState.selectedLogoReferenceImageId === "string" ? persistedState.selectedLogoReferenceImageId : currentState.selectedLogoReferenceImageId,
      logoGenerationTargetBrandId: typeof persistedState.logoGenerationTargetBrandId === "string" && brands.some((brand) => brand.id === persistedState.logoGenerationTargetBrandId) ? persistedState.logoGenerationTargetBrandId : undefined,
      memberDraft,
      selectedLogoId,
      savedGeneratedLogoOptions,
      orderOptions: persistedState.orderOptions ?? currentState.orderOptions,
      selectedPaymentMethod: persistedState.selectedPaymentMethod ?? currentState.selectedPaymentMethod,
      isAuthenticated,
      users: persistedState.users ?? currentState.users,
      authSession: persistedState.authSession ?? currentState.authSession,
      selectedBrandId,
      activeBusinessCardDraftId,
      lastOrderId: persistedState.lastOrderId ?? currentState.lastOrderId,
      brands,
      businessCardDrafts,
      orders: shouldRestoreWorkspaceArrays ? persistedState.orders ?? currentState.orders : currentState.orders,
      selectedTemplateId: persistedState.selectedTemplateId ?? currentState.selectedTemplateId,
      selectedBusinessCardMemberIds: Array.isArray(persistedState.selectedBusinessCardMemberIds) ? persistedState.selectedBusinessCardMemberIds.filter((id) => typeof id === "string") : currentState.selectedBusinessCardMemberIds,
      brandWorkspaceHasPendingLocalChanges: Boolean(persistedState.brandWorkspaceHasPendingLocalChanges || hasLegacyPersistedWorkspaceArrays),
      brandWorkspaceOwnerUserId: persistedOwnerUserId,
      generatedLogoOptions: [],
      logoGenerationStatus: "idle",
      logoGenerationMessage: undefined,
      logoGenerationIntent: "initial",
      logoRevisionRequest: "",
      logoRevisionSourceLogoId: undefined,
      templates: currentState.templates,
      loginRedirectTarget: undefined,
      loginBackStep: undefined,
    };
  },
} satisfies PersistOptions<PrintyState, Partial<PrintyState>>;
