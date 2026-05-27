import type { StateCreator } from "zustand";
import { isPlaceholderBrandName, readGeneratedLogoBrandContext } from "@/lib/logo/generatedLogoBrandContext";
import { findGeneratedLogoInState } from "@/lib/logo/generatedLogoLookup";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { logoOptions } from "@/lib/mock-data";
import { saveGeneratedLogo } from "@/store/printy-store-generated-logos";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyLogoActions = Pick<
  PrintyState,
  | "selectLogo"
  | "selectBrandLogo"
  | "deleteBrandLogo"
  | "startLogoGeneration"
  | "setActiveLogoGenerationJob"
  | "beginBackgroundLogoGeneration"
  | "dismissBackgroundLogoGenerationNotice"
  | "openBackgroundGeneratedLogos"
  | "finishLogoGeneration"
  | "failLogoGeneration"
  | "setLogoGenerationMode"
  | "selectLogoReferenceImage"
  | "startLogoRevision"
  | "updateLogoRevisionRequest"
  | "cancelLogoRevision"
  | "submitLogoRevision"
  | "startAdditionalLogoForBrand"
  | "startUploadedLogoForNewBrand"
  | "startUploadedLogoForBrand"
  | "startUploadedLogoRegistration"
  | "registerUploadedLogo"
>;

export function createPrintyLogoActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyLogoActions {
  return {
    selectLogo: (logoId) =>
      set((state) => {
        const generatedLogo = findGeneratedLogoInState(state, logoId);

        return {
          selectedLogoId: logoId,
          savedGeneratedLogoOptions: generatedLogo ? saveGeneratedLogo(state.savedGeneratedLogoOptions, generatedLogo) : state.savedGeneratedLogoOptions,
          brandWorkspaceHasPendingLocalChanges: generatedLogo ? true : state.brandWorkspaceHasPendingLocalChanges,
        };
      }),
    selectBrandLogo: (brandId, logoId) =>
      set((state) => {
        const generatedLogo = findGeneratedLogoInState(state, logoId);

        return {
          selectedLogoId: logoId,
          brands: state.brands.map((brand) => (brand.id === brandId ? { ...brand, selectedLogoId: logoId, logoIds: Array.from(new Set([logoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : [])])) } : brand)),
          savedGeneratedLogoOptions: generatedLogo ? saveGeneratedLogo(state.savedGeneratedLogoOptions, generatedLogo) : state.savedGeneratedLogoOptions,
          brandWorkspaceHasPendingLocalChanges: true,
        };
      }),
    deleteBrandLogo: (brandId, logoId) =>
      set((state) => {
        const targetBrand = state.brands.find((brand) => brand.id === brandId);

        if (!targetBrand) {
          return {};
        }

        const currentLogoIds = Array.from(new Set([targetBrand.selectedLogoId, ...(Array.isArray(targetBrand.logoIds) ? targetBrand.logoIds : [])]));
        const currentGeneratedLogoIds = currentLogoIds.filter((item) => findGeneratedLogoInState(state, item));

        if (currentGeneratedLogoIds.length <= 1 && findGeneratedLogoInState(state, logoId)) {
          return {};
        }

        const remainingLogoIds = currentLogoIds.filter((item) => item !== logoId);
        const nextSelectedLogoId = targetBrand.selectedLogoId === logoId ? remainingLogoIds[0] ?? logoOptions[0].id : targetBrand.selectedLogoId;
        const nextBrandLogoIds = Array.from(new Set([nextSelectedLogoId, ...remainingLogoIds]));
        const brands = state.brands.map((brand) => (brand.id === brandId ? { ...brand, selectedLogoId: nextSelectedLogoId, logoIds: nextBrandLogoIds } : brand));
        const businessCardDrafts = state.businessCardDrafts.map((draft) => (draft.brandId === brandId && draft.selectedLogoId === logoId ? { ...draft, selectedLogoId: nextSelectedLogoId } : draft));
        const selectedLogoId = state.selectedLogoId === logoId ? nextSelectedLogoId : state.selectedLogoId;
        const isStillReferenced = brands.some((brand) => brand.selectedLogoId === logoId || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logoId))) || businessCardDrafts.some((draft) => draft.selectedLogoId === logoId);

        return {
          brands,
          businessCardDrafts,
          selectedLogoId,
          savedGeneratedLogoOptions: isStillReferenced ? state.savedGeneratedLogoOptions : state.savedGeneratedLogoOptions.filter((logo) => logo.id !== logoId),
          generatedLogoOptions: state.generatedLogoOptions.filter((logo) => logo.id !== logoId),
          brandWorkspaceHasPendingLocalChanges: true,
        };
      }),
    startLogoGeneration: () =>
      set((state) => {
        const sourceLogo = state.logoRevisionSourceLogoId ? findGeneratedLogoInState(state, state.logoRevisionSourceLogoId) : undefined;

        return {
          generatedLogoOptions: [],
          logoGenerationStatus: "generating",
          logoGenerationMessage:
            state.logoGenerationIntent === "revision"
              ? logoUiCopy.revisionGeneration.message
              : logoUiCopy.initialGeneration.message,
          savedGeneratedLogoOptions: sourceLogo ? saveGeneratedLogo(state.savedGeneratedLogoOptions, sourceLogo) : state.savedGeneratedLogoOptions,
          brandWorkspaceHasPendingLocalChanges: sourceLogo ? true : state.brandWorkspaceHasPendingLocalChanges,
        };
      }),
    setActiveLogoGenerationJob: (jobId) => set({ activeLogoGenerationJobId: jobId }),
    beginBackgroundLogoGeneration: (brandId, message) =>
      set((state) => {
        const brand = state.brands.find((item) => item.id === brandId);

        return {
          onboardingComplete: true,
          activeTab: "home",
          brandView: "list",
          selectedBrandId: brandId,
          activeBrandSection: "style",
          logoGenerationTargetBrandId: brandId,
          brandDraft: brand ? { name: brand.name, category: brand.category, designRequest: brand.designRequest } : state.brandDraft,
          backgroundLogoGenerationNotice: {
            brandId,
            status: "generating",
            message: message ?? "로고를 백그라운드에서 만들고 있어요.",
          },
        };
      }),
    dismissBackgroundLogoGenerationNotice: () => set({ backgroundLogoGenerationNotice: undefined, activeLogoGenerationJobId: undefined }),
    openBackgroundGeneratedLogos: () =>
      set((state) => {
        const noticeBrand = state.backgroundLogoGenerationNotice ? state.brands.find((brand) => brand.id === state.backgroundLogoGenerationNotice?.brandId) : undefined;
        const brandLogoIds = noticeBrand ? Array.from(new Set([noticeBrand.selectedLogoId, ...(Array.isArray(noticeBrand.logoIds) ? noticeBrand.logoIds : [])])) : [];
        const brandGeneratedLogos = brandLogoIds.map((logoId) => findGeneratedLogoInState(state, logoId)).filter((logo): logo is NonNullable<ReturnType<typeof findGeneratedLogoInState>> => Boolean(logo));

        return {
          onboardingComplete: false,
          currentStep: "logoSelection",
          generatedLogoOptions: brandGeneratedLogos.length > 0 ? brandGeneratedLogos : state.generatedLogoOptions,
          selectedLogoId: brandGeneratedLogos[0]?.id ?? state.selectedLogoId,
          backgroundLogoGenerationNotice: undefined,
        };
      }),
    finishLogoGeneration: (status, logos, message) =>
      set((state) => {
        const firstLogo = logos[0];
        const revisionSourceLogoId = state.logoRevisionSourceLogoId;
        const sourceLogo = revisionSourceLogoId ? findGeneratedLogoInState(state, revisionSourceLogoId) : undefined;
        const targetBrand = (state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined) ?? (revisionSourceLogoId ? state.brands.find((brand) => brand.selectedLogoId === revisionSourceLogoId || brand.logoIds?.includes(revisionSourceLogoId)) : undefined);
        const isBackgroundGeneration = Boolean(targetBrand && state.backgroundLogoGenerationNotice?.brandId === targetBrand.id && state.backgroundLogoGenerationNotice.status === "generating");
        const isActiveTargetGeneration = Boolean(targetBrand && state.currentStep === "generating");
        const previousUnsavedGeneratedLogoIds = new Set(state.generatedLogoOptions.map((logo) => logo.id));
        const savedWithoutPreviousGeneration = state.savedGeneratedLogoOptions.filter((logo) => !previousUnsavedGeneratedLogoIds.has(logo.id));
        const savedWithSource = sourceLogo ? saveGeneratedLogo(savedWithoutPreviousGeneration, sourceLogo) : savedWithoutPreviousGeneration;
        const savedWithGeneratedLogos = logos.reduce((savedLogos, logo) => saveGeneratedLogo(savedLogos, logo), savedWithSource);
        const generatedLogoIds = logos.map((logo) => logo.id);

        return {
          brands: targetBrand
            ? state.brands.map((brand) => {
                if (brand.id !== targetBrand.id) {
                  return brand;
                }

                const currentLogoIds = Array.from(new Set([brand.selectedLogoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : [])]));
                const nextLogoIds = Array.from(new Set([...generatedLogoIds, ...currentLogoIds]));

                return { ...brand, logoIds: nextLogoIds };
              })
            : state.brands,
          generatedLogoOptions: isActiveTargetGeneration || isBackgroundGeneration ? [] : logos,
          logoGenerationStatus: status,
          logoGenerationMessage: message,
          selectedLogoId: firstLogo?.id ?? state.selectedLogoId,
          savedGeneratedLogoOptions: savedWithGeneratedLogos,
          brandWorkspaceHasPendingLocalChanges: firstLogo || sourceLogo ? true : state.brandWorkspaceHasPendingLocalChanges,
          logoGenerationIntent: "initial",
          activeLogoGenerationJobId: undefined,
          onboardingComplete: isBackgroundGeneration || isActiveTargetGeneration ? true : state.onboardingComplete,
          activeTab: isActiveTargetGeneration ? "brands" : state.activeTab,
          brandView: isActiveTargetGeneration ? "detail" : state.brandView,
          selectedBrandId: targetBrand?.id ?? state.selectedBrandId,
          activeBrandSection: isActiveTargetGeneration ? "style" : state.activeBrandSection,
          backgroundLogoGenerationNotice: isBackgroundGeneration && targetBrand
            ? {
                brandId: targetBrand.id,
                status: "ready",
                message: "새 로고가 준비됐어요.",
              }
            : state.backgroundLogoGenerationNotice,
          logoRevisionRequest: "",
          logoRevisionSourceLogoId: undefined,
        };
      }),
    failLogoGeneration: (message) =>
      set((state) => {
        const targetBrand = state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined;
        const isBackgroundGeneration = Boolean(targetBrand && state.backgroundLogoGenerationNotice?.brandId === targetBrand.id && state.backgroundLogoGenerationNotice.status === "generating");

        return {
          generatedLogoOptions: [],
          logoGenerationStatus: "error",
          logoGenerationMessage: message,
          activeLogoGenerationJobId: undefined,
          onboardingComplete: isBackgroundGeneration ? true : state.onboardingComplete,
          activeTab: state.activeTab,
          brandView: state.brandView,
          selectedBrandId: targetBrand?.id ?? state.selectedBrandId,
          activeBrandSection: state.activeBrandSection,
          backgroundLogoGenerationNotice: isBackgroundGeneration && targetBrand
            ? {
                brandId: targetBrand.id,
                status: "failed",
                message,
              }
            : state.backgroundLogoGenerationNotice,
        };
      }),
    setLogoGenerationMode: (mode) => set({ logoGenerationMode: mode }),
    selectLogoReferenceImage: (referenceImageId) => set({ selectedLogoReferenceImageId: referenceImageId }),
    startLogoRevision: (sourceLogoId, brandId) =>
      set((state) => {
        const sourceLogo = findGeneratedLogoInState(state, sourceLogoId);
        const targetBrand = (brandId ? state.brands.find((brand) => brand.id === brandId) : undefined) ?? (state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined) ?? state.brands.find((brand) => brand.selectedLogoId === sourceLogoId || brand.logoIds?.includes(sourceLogoId));

        if (!sourceLogo) {
          return {
            currentStep: "logoSelection",
            logoGenerationStatus: "error",
            logoGenerationMessage: `${logoUiCopy.missingSourceLogo.title}. ${logoUiCopy.missingSourceLogo.message}`,
            logoGenerationIntent: "initial",
            logoRevisionRequest: "",
            logoRevisionSourceLogoId: undefined,
          };
        }

        const logoContext = readGeneratedLogoBrandContext(sourceLogo);
        const brandName = targetBrand && !isPlaceholderBrandName(targetBrand.name) ? targetBrand.name : logoContext.name ?? targetBrand?.name ?? state.brandDraft.name;
        const category = targetBrand?.category.trim() ? targetBrand.category : logoContext.category ?? state.brandDraft.category;
        const designRequest = targetBrand?.designRequest.trim() ? targetBrand.designRequest : sourceLogo.designRequest ?? state.brandDraft.designRequest;

        return {
          onboardingComplete: false,
          currentStep: "logoRevision",
          brandDraft: { name: brandName, category, designRequest },
          selectedLogoId: sourceLogoId,
          selectedBrandId: targetBrand?.id ?? state.selectedBrandId,
          brands: targetBrand
            ? state.brands.map((brand) => (brand.id === targetBrand.id ? { ...brand, logoIds: Array.from(new Set([sourceLogoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : []), brand.selectedLogoId])) } : brand))
            : state.brands,
          logoGenerationTargetBrandId: targetBrand?.id ?? state.logoGenerationTargetBrandId,
          logoGenerationIntent: "revision",
          logoGenerationStatus: "idle",
          logoGenerationMessage: undefined,
          activeLogoGenerationJobId: undefined,
          logoRevisionRequest: "",
          logoRevisionSourceLogoId: sourceLogoId,
          savedGeneratedLogoOptions: saveGeneratedLogo(state.savedGeneratedLogoOptions, sourceLogo),
          brandWorkspaceHasPendingLocalChanges: true,
        };
      }),
    updateLogoRevisionRequest: (value) => set({ logoRevisionRequest: value }),
    cancelLogoRevision: () =>
      set({
        currentStep: "logoSelection",
        logoGenerationIntent: "initial",
        logoRevisionRequest: "",
        logoRevisionSourceLogoId: undefined,
      }),
    submitLogoRevision: () => {
      const state = get();
      const sourceLogo = state.logoRevisionSourceLogoId ? findGeneratedLogoInState(state, state.logoRevisionSourceLogoId) : undefined;

      const revisionRequest = state.logoRevisionRequest.trim();

      if (!sourceLogo) {
        set({
          currentStep: "logoSelection",
          logoGenerationStatus: "error",
          logoGenerationMessage: `${logoUiCopy.missingSourceLogo.title}. ${logoUiCopy.missingSourceLogo.message}`,
          logoGenerationIntent: "initial",
          logoRevisionRequest: "",
          logoRevisionSourceLogoId: undefined,
        });
        return;
      }

      if (revisionRequest.length === 0) {
        set({
          logoGenerationStatus: "error",
          logoGenerationMessage: "수정 요청을 입력해 주세요.",
        });
        return;
      }

      if (revisionRequest.length > 1000) {
        set({
          logoGenerationStatus: "error",
          logoGenerationMessage: "수정 요청이 너무 길어요. 다시 적어 주세요.",
        });
        return;
      }

      set({ currentStep: "generating", logoGenerationIntent: "revision", activeLogoGenerationJobId: undefined });
    },
    startAdditionalLogoForBrand: (brandId) => {
      const brand = get().brands.find((item) => item.id === brandId);

      if (!brand) {
        return;
      }

      set({
        onboardingComplete: false,
        currentStep: "logoDirection",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        selectedBrandId: brand.id,
        logoGenerationTargetBrandId: brand.id,
        generatedLogoOptions: [],
        logoGenerationStatus: "idle",
        logoGenerationMessage: undefined,
        logoGenerationMode: "manual",
        logoGenerationIntent: "initial",
        logoRevisionRequest: "",
        logoRevisionSourceLogoId: undefined,
      });
    },
    startUploadedLogoForNewBrand: () =>
      set({
        currentStep: "brandCreation",
        onboardingComplete: false,
        brandLogoSetupMode: "upload",
        logoGenerationTargetBrandId: undefined,
        generatedLogoOptions: [],
        logoGenerationStatus: "idle",
        logoGenerationMessage: undefined,
        logoGenerationIntent: "initial",
        logoRevisionRequest: "",
        logoRevisionSourceLogoId: undefined,
      }),
    startUploadedLogoForBrand: (brandId) => {
      const brand = get().brands.find((item) => item.id === brandId);

      if (!brand) {
        return;
      }

      set({
        onboardingComplete: false,
        currentStep: "logoUpload",
        brandLogoSetupMode: "upload",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        selectedBrandId: brand.id,
        logoGenerationTargetBrandId: brand.id,
        generatedLogoOptions: [],
        logoGenerationStatus: "idle",
        logoGenerationMessage: undefined,
        logoGenerationIntent: "initial",
        logoRevisionRequest: "",
        logoRevisionSourceLogoId: undefined,
      });
    },
    startUploadedLogoRegistration: () =>
      set({
        currentStep: "generating",
        logoGenerationIntent: "upload",
        logoGenerationStatus: "generating",
        logoGenerationMessage: "올린 로고를 Printy 저장 형식에 맞게 정리하고 있어요.",
      }),
    registerUploadedLogo: (logo) =>
      set((state) => {
        const targetBrand = state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined;
        const isBackgroundRegistration = Boolean(targetBrand && state.backgroundLogoGenerationNotice?.brandId === targetBrand.id && state.backgroundLogoGenerationNotice.status === "generating");
        const isActiveRegistrationScreen = state.currentStep === "generating" && state.logoGenerationIntent === "upload";
        const isActiveTargetRegistration = Boolean(targetBrand && isActiveRegistrationScreen);
        const savedGeneratedLogoOptions = saveGeneratedLogo(state.savedGeneratedLogoOptions, logo);

        return {
          brands: targetBrand
            ? state.brands.map((brand) => (brand.id === targetBrand.id ? { ...brand, logoIds: Array.from(new Set([logo.id, ...(Array.isArray(brand.logoIds) ? brand.logoIds : []), brand.selectedLogoId])) } : brand))
            : state.brands,
          generatedLogoOptions: [logo],
          savedGeneratedLogoOptions,
          selectedLogoId: logo.id,
          logoGenerationStatus: "success",
          logoGenerationMessage: undefined,
          currentStep: isActiveRegistrationScreen ? "logoSave" : state.currentStep,
          selectedBrandId: targetBrand?.id ?? state.selectedBrandId,
          onboardingComplete: isBackgroundRegistration || isActiveTargetRegistration ? true : state.onboardingComplete,
          activeTab: isActiveTargetRegistration ? "brands" : state.activeTab,
          brandView: isActiveTargetRegistration ? "detail" : state.brandView,
          activeBrandSection: isActiveTargetRegistration ? "style" : state.activeBrandSection,
          backgroundLogoGenerationNotice: isBackgroundRegistration && targetBrand
            ? {
                brandId: targetBrand.id,
                status: "ready",
                message: "등록한 로고가 준비됐어요.",
              }
            : state.backgroundLogoGenerationNotice,
          logoGenerationIntent: "initial",
          brandWorkspaceHasPendingLocalChanges: true,
        };
      }),
  };
}
