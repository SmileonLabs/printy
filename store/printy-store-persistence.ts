import { createJSONStorage, type PersistOptions } from "zustand/middleware";
import { normalizeBusinessCardTemplateLayout } from "@/lib/business-card-templates";
import { isSelectableLogoId, normalizeBrandAsset, normalizeBrandWithSelectableLogos, normalizeBusinessCardDraftWithSelectableLogos, normalizeGeneratedLogos, normalizeSelectableLogoId } from "@/store/printy-store-normalizers";
import type { BusinessCardColorPaletteId, BusinessCardProductionOptions, BusinessCardUserElementId, MainTab } from "@/lib/types";
import type { PrintyState } from "@/store/printy-store-types";

export const PRINTY_STORE_STORAGE_KEY = "printy-store";

const defaultBusinessCardProductionOptions: BusinessCardProductionOptions = { frontElements: [], backElements: [], color: "black" };
const businessCardUserElementIds: readonly BusinessCardUserElementId[] = ["brandName", "category", "name", "role", "phone", "mainPhone", "fax", "email", "website", "address", "account", "titleLine1", "titleLine2", "adLine1", "adLine2", "instagram", "instagramIcon", "qrCode"];
const businessCardColorPaletteIds: readonly BusinessCardColorPaletteId[] = ["black", "white", "green", "yellow", "blue", "red"];

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
      (state.aiBusinessCardMockups?.length ?? 0) > 0 ||
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

function isBusinessCardUserElementId(value: unknown): value is BusinessCardUserElementId {
  return typeof value === "string" && businessCardUserElementIds.includes(value as BusinessCardUserElementId);
}

function isBusinessCardColorPaletteId(value: unknown): value is BusinessCardColorPaletteId {
  return typeof value === "string" && businessCardColorPaletteIds.includes(value as BusinessCardColorPaletteId);
}

function normalizeBusinessCardProductionOptions(value: unknown, fallback: BusinessCardProductionOptions) {
  if (typeof value !== "object" || value === null) {
    return fallback;
  }

  const record = value as { frontElements?: unknown; backElements?: unknown; color?: unknown; layout?: unknown };
  const frontElements = Array.isArray(record.frontElements) ? record.frontElements.filter(isBusinessCardUserElementId) : fallback.frontElements;
  const backElements = Array.isArray(record.backElements) ? record.backElements.filter(isBusinessCardUserElementId) : fallback.backElements;

  return {
    frontElements,
    backElements,
    color: isBusinessCardColorPaletteId(record.color) ? record.color : fallback.color,
    layout: normalizeBusinessCardTemplateLayout(record.layout),
  } satisfies BusinessCardProductionOptions;
}

function hasSavedBrandWorkspaceArrays(state: Partial<PrintyState>) {
  return Boolean(
      (state.brands?.length ?? 0) > 0 ||
      (state.businessCardDrafts?.length ?? 0) > 0 ||
      (state.orders?.length ?? 0) > 0 ||
      (state.brandAssets?.length ?? 0) > 0 ||
      (state.savedGeneratedLogoOptions?.length ?? 0) > 0,
  );
}

function isPersistedMockupAsset(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as { assetType?: unknown; productId?: unknown };

  return record.assetType === "mockup" || (typeof record.productId === "string" && record.productId.startsWith("brand-mockup-"));
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

function shouldPersistBrandDraftForStep(step: unknown) {
  return step === "brandCreation" || step === "logoDirection" || step === "logoUpload" || step === "generating" || step === "logoSelection" || step === "logoSave" || step === "logoRevision" || step === "memberInput" || step === "businessCardPreview" || step === "orderOptions" || step === "checkout";
}

function shouldPersistMemberDraftForStep(step: unknown) {
  return step === "memberInput" || step === "businessCardPreview" || step === "orderOptions" || step === "checkout";
}

export const printyStorePersistOptions = {
  name: PRINTY_STORE_STORAGE_KEY,
  version: 6,
  storage: createJSONStorage<Partial<PrintyState>>(() => localStorage),
  migrate: (persistedState, version) => {
    if (!isPersistedPrintyState(persistedState)) {
      return {};
    }

    if (version >= 6) {
      return persistedState;
    }

    if (version >= 4) {
      if (persistedState.isAuthenticated && persistedState.authSession) {
        return {
          ...persistedState,
          brands: [],
          brandAssets: [],
          savedGeneratedLogoOptions: [],
          generatedLogoOptions: [],
          businessCardDrafts: [],
          orders: [],
          selectedBrandId: undefined,
          activeBusinessCardDraftId: undefined,
          lastOrderId: undefined,
          activeBrandMockupJob: undefined,
          activeLogoGenerationJobId: undefined,
          backgroundLogoGenerationNotice: undefined,
          brandWorkspaceHasPendingLocalChanges: false,
          brandWorkspaceOwnerUserId: undefined,
        } satisfies Partial<PrintyState>;
      }

      return persistedState;
    }

    if (version >= 3) {
      return {
        ...persistedState,
        brandAssets: Array.isArray(persistedState.brandAssets) ? persistedState.brandAssets.filter((asset) => !isPersistedMockupAsset(asset)) : [],
        brandWorkspaceHasPendingLocalChanges: persistedState.brandWorkspaceHasPendingLocalChanges,
      } satisfies Partial<PrintyState>;
    }

    return {
      currentStep: "home",
      onboardingComplete: false,
      activeTab: "home",
      brandView: "list",
      activeBrandSection: "style",
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
      brandAssets: [],
      selectedLogoId: undefined,
      selectedBrandId: undefined,
      activeBusinessCardDraftId: undefined,
      lastOrderId: undefined,
      selectedBusinessCardMemberIds: [],
      businessCardProductionOptions: defaultBusinessCardProductionOptions,
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
      brandLogoSetupMode: state.brandLogoSetupMode,
      logoGenerationMode: state.logoGenerationMode,
      selectedLogoReferenceImageId: state.selectedLogoReferenceImageId,
      logoGenerationTargetBrandId: state.logoGenerationTargetBrandId,
      activeLogoGenerationJobId: state.activeLogoGenerationJobId,
      backgroundLogoGenerationNotice: state.backgroundLogoGenerationNotice,
      activeBrandMockupJob: state.activeBrandMockupJob,
      aiBusinessCardMockups: state.aiBusinessCardMockups,
      aiBusinessCardMockupStatus: state.aiBusinessCardMockupStatus,
      aiBusinessCardMockupMessage: state.aiBusinessCardMockupMessage,
      aiBusinessCardMockupSignature: state.aiBusinessCardMockupSignature,
      activeAiBusinessCardMockupJobId: state.activeAiBusinessCardMockupJobId,
      selectedAiBusinessCardMockupUrl: state.selectedAiBusinessCardMockupUrl,
      brandDraft: shouldPersistBrandDraftForStep(state.currentStep) || state.activeLogoGenerationJobId ? state.brandDraft : undefined,
      memberDraft: shouldPersistMemberDraftForStep(state.currentStep) ? state.memberDraft : undefined,
      selectedLogoId: state.selectedLogoId,
      ...(persistBrandWorkspaceArrays
        ? {
            savedGeneratedLogoOptions: state.savedGeneratedLogoOptions.filter((logo) => logo.id === state.selectedLogoId || state.brands.some((brand) => brand.selectedLogoId === logo.id || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logo.id))) || state.businessCardDrafts.some((draft) => draft.selectedLogoId === logo.id)),
            brands: state.brands,
            brandAssets: state.brandAssets,
            businessCardDrafts: state.businessCardDrafts,
            orders: state.orders,
          }
        : {}),
      orderOptions: state.orderOptions,
      selectedPaymentMethod: state.selectedPaymentMethod,
      shippingInfo: state.shippingInfo,
      isAuthenticated: state.isAuthenticated,
      users: state.users,
      authSession: state.authSession,
      selectedBrandId: state.selectedBrandId,
      activeBusinessCardDraftId: state.activeBusinessCardDraftId,
      lastOrderId: state.lastOrderId,
      selectedTemplateId: state.selectedTemplateId,
      selectedBusinessCardMemberIds: state.selectedBusinessCardMemberIds,
      businessCardProductionOptions: state.businessCardProductionOptions,
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
    const brandIds = new Set(brands.map((brand) => brand.id));
    const brandAssets = (persistedWorkspaceState.brandAssets ?? currentState.brandAssets).map((asset) => normalizeBrandAsset(asset)).filter((asset): asset is NonNullable<typeof asset> => asset !== undefined && brandIds.has(asset.brandId));
    const activeBrandMockupJob = shouldRestoreWorkspaceArrays && persistedState.activeBrandMockupJob && typeof persistedState.activeBrandMockupJob.jobId === "string" && typeof persistedState.activeBrandMockupJob.brandId === "string" && typeof persistedState.activeBrandMockupJob.logoId === "string" && typeof persistedState.activeBrandMockupJob.sceneId === "string" && (persistedState.activeBrandMockupJob.status === "generating" || persistedState.activeBrandMockupJob.status === "ready" || persistedState.activeBrandMockupJob.status === "failed") && typeof persistedState.activeBrandMockupJob.message === "string" && (persistedState.activeBrandMockupJob.assetId === undefined || typeof persistedState.activeBrandMockupJob.assetId === "string") ? persistedState.activeBrandMockupJob : undefined;
    const shouldRestoreAiBusinessCardMockups = !persistedState.isAuthenticated || (Boolean(persistedAuthUserId) && persistedOwnerUserId === persistedAuthUserId);
    const aiBusinessCardMockups = shouldRestoreAiBusinessCardMockups && Array.isArray(persistedState.aiBusinessCardMockups)
      ? persistedState.aiBusinessCardMockups.filter((mockup) => typeof mockup === "object" && mockup !== null && typeof mockup.id === "string" && typeof mockup.imageUrl === "string" && typeof mockup.cleanImageUrl === "string" && typeof mockup.title === "string")
      : currentState.aiBusinessCardMockups;
    const aiBusinessCardMockupStatus = shouldRestoreAiBusinessCardMockups
      ? persistedState.aiBusinessCardMockupStatus === "generating" || persistedState.aiBusinessCardMockupStatus === "ready" || persistedState.aiBusinessCardMockupStatus === "failed"
          ? persistedState.aiBusinessCardMockupStatus
          : currentState.aiBusinessCardMockupStatus
      : currentState.aiBusinessCardMockupStatus;
    const aiBusinessCardMockupMessage = shouldRestoreAiBusinessCardMockups
      ? persistedState.aiBusinessCardMockupStatus === "generating"
        ? "명함 목업 디자인을 백그라운드에서 계속 확인하고 있어요."
        : typeof persistedState.aiBusinessCardMockupMessage === "string"
          ? persistedState.aiBusinessCardMockupMessage
          : undefined
      : currentState.aiBusinessCardMockupMessage;
    const businessCardDrafts = (persistedWorkspaceState.businessCardDrafts ?? currentState.businessCardDrafts).map((draft) => normalizeBusinessCardDraftWithSelectableLogos(draft, savedGeneratedLogoOptions));
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
    const activeLogoGenerationJobId = typeof persistedState.activeLogoGenerationJobId === "string" && persistedState.activeLogoGenerationJobId.trim().length > 0 ? persistedState.activeLogoGenerationJobId.trim() : undefined;
    const persistedStep = (persistedState as { currentStep?: unknown }).currentStep;
    const currentStep = shouldShowHomeForPersistedGuest(persistedState) ? "home" : activeLogoGenerationJobId ? "generating" : persistedStep === "logoRevision" ? "logoSelection" : persistedStep === "templateSelection" || persistedStep === "businessCardBatchPreview" ? "businessCardPreview" : persistedState.currentStep ?? currentState.currentStep;
    const persistedActiveTab = persistedState.activeTab === "notifications" ? "home" : persistedState.activeTab;
    const currentActiveTab = currentState.activeTab === "notifications" ? "home" : currentState.activeTab;
    const activeTab = isMainTab(persistedActiveTab) ? persistedActiveTab : isMainTab(currentActiveTab) ? currentActiveTab : "home";
    const restoredGeneratedLogoOptions = currentStep === "logoSelection" || currentStep === "logoSave" ? savedGeneratedLogoOptions.filter((logo) => logo.id === selectedLogoId || (typeof persistedState.logoGenerationTargetBrandId === "string" && brands.some((brand) => brand.id === persistedState.logoGenerationTargetBrandId && Array.isArray(brand.logoIds) && brand.logoIds.includes(logo.id)))) : [];

    return {
      ...currentState,
      currentStep,
      onboardingComplete: isAuthenticated ? persistedState.onboardingComplete ?? currentState.onboardingComplete : false,
      activeTab,
      brandView: activeTab === "brands" && selectedBrandId && persistedState.brandView === "detail" ? "detail" : "list",
      activeBrandSection: persistedState.activeBrandSection ?? currentState.activeBrandSection,
      brandDraft: persistedState.brandDraft && typeof persistedState.brandDraft.name === "string" && typeof persistedState.brandDraft.category === "string" && typeof persistedState.brandDraft.designRequest === "string" ? persistedState.brandDraft : currentState.brandDraft,
      brandLogoSetupMode: persistedState.brandLogoSetupMode === "upload" ? "upload" : currentState.brandLogoSetupMode,
      logoGenerationMode: persistedState.logoGenerationMode === "auto" || persistedState.logoGenerationMode === "reference" ? persistedState.logoGenerationMode : currentState.logoGenerationMode,
      selectedLogoReferenceImageId: typeof persistedState.selectedLogoReferenceImageId === "string" ? persistedState.selectedLogoReferenceImageId : currentState.selectedLogoReferenceImageId,
      logoGenerationTargetBrandId: typeof persistedState.logoGenerationTargetBrandId === "string" && brands.some((brand) => brand.id === persistedState.logoGenerationTargetBrandId) ? persistedState.logoGenerationTargetBrandId : undefined,
      activeLogoGenerationJobId,
      backgroundLogoGenerationNotice: persistedState.backgroundLogoGenerationNotice,
      memberDraft: persistedState.memberDraft && typeof persistedState.memberDraft.name === "string" && typeof persistedState.memberDraft.role === "string" && typeof persistedState.memberDraft.phone === "string" && typeof persistedState.memberDraft.mainPhone === "string" && typeof persistedState.memberDraft.fax === "string" && typeof persistedState.memberDraft.email === "string" && typeof persistedState.memberDraft.address === "string" ? persistedState.memberDraft : currentState.memberDraft,
      selectedLogoId,
      savedGeneratedLogoOptions,
      orderOptions: persistedState.orderOptions ?? currentState.orderOptions,
      selectedPaymentMethod: persistedState.selectedPaymentMethod ?? currentState.selectedPaymentMethod,
      shippingInfo:
        persistedState.shippingInfo &&
        typeof persistedState.shippingInfo.recipientName === "string" &&
        typeof persistedState.shippingInfo.recipientPhone === "string" &&
        typeof persistedState.shippingInfo.address === "string" &&
        typeof persistedState.shippingInfo.memo === "string"
          ? persistedState.shippingInfo
          : currentState.shippingInfo,
      isAuthenticated,
      users: persistedState.users ?? currentState.users,
      authSession: persistedState.authSession ?? currentState.authSession,
      selectedBrandId,
      activeBusinessCardDraftId,
      lastOrderId: persistedState.lastOrderId ?? currentState.lastOrderId,
      brands,
      brandAssets,
      activeBrandMockupJob,
      aiBusinessCardMockups,
      aiBusinessCardMockupStatus,
      aiBusinessCardMockupMessage,
      aiBusinessCardMockupSignature: shouldRestoreAiBusinessCardMockups && typeof persistedState.aiBusinessCardMockupSignature === "string" ? persistedState.aiBusinessCardMockupSignature : currentState.aiBusinessCardMockupSignature,
      activeAiBusinessCardMockupJobId: shouldRestoreAiBusinessCardMockups && typeof persistedState.activeAiBusinessCardMockupJobId === "string" ? persistedState.activeAiBusinessCardMockupJobId : currentState.activeAiBusinessCardMockupJobId,
      selectedAiBusinessCardMockupUrl: shouldRestoreAiBusinessCardMockups && typeof persistedState.selectedAiBusinessCardMockupUrl === "string" ? persistedState.selectedAiBusinessCardMockupUrl : currentState.selectedAiBusinessCardMockupUrl,
      businessCardDrafts,
      orders: shouldRestoreWorkspaceArrays ? persistedState.orders ?? currentState.orders : currentState.orders,
      selectedTemplateId: persistedState.selectedTemplateId ?? currentState.selectedTemplateId,
      selectedBusinessCardMemberIds: Array.isArray(persistedState.selectedBusinessCardMemberIds) ? persistedState.selectedBusinessCardMemberIds.filter((id) => typeof id === "string") : currentState.selectedBusinessCardMemberIds,
      businessCardProductionOptions: normalizeBusinessCardProductionOptions(persistedState.businessCardProductionOptions, currentState.businessCardProductionOptions),
      brandWorkspaceHasPendingLocalChanges: Boolean(persistedState.brandWorkspaceHasPendingLocalChanges || hasLegacyPersistedWorkspaceArrays),
      brandWorkspaceOwnerUserId: persistedOwnerUserId,
      generatedLogoOptions: restoredGeneratedLogoOptions,
      logoGenerationStatus: activeLogoGenerationJobId ? "generating" : "idle",
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
