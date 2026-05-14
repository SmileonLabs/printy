import type { StateCreator } from "zustand";
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
  | "finishLogoGeneration"
  | "failLogoGeneration"
  | "setLogoGenerationMode"
  | "selectLogoReferenceImage"
  | "startLogoRevision"
  | "updateLogoRevisionRequest"
  | "cancelLogoRevision"
  | "submitLogoRevision"
  | "startAdditionalLogoForBrand"
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
        const selectedLogoId = state.selectedLogoId === logoId ? nextSelectedLogoId : state.selectedLogoId;
        const isStillReferenced = brands.some((brand) => brand.selectedLogoId === logoId || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logoId))) || state.businessCardDrafts.some((draft) => draft.selectedLogoId === logoId);

        return {
          brands,
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
    finishLogoGeneration: (status, logos, message) =>
      set((state) => {
        const firstLogo = logos[0];
        const sourceLogo = state.logoRevisionSourceLogoId ? findGeneratedLogoInState(state, state.logoRevisionSourceLogoId) : undefined;
        const previousUnsavedGeneratedLogoIds = new Set(state.generatedLogoOptions.map((logo) => logo.id));
        const savedWithoutPreviousGeneration = state.savedGeneratedLogoOptions.filter((logo) => !previousUnsavedGeneratedLogoIds.has(logo.id));
        const savedWithSource = sourceLogo ? saveGeneratedLogo(savedWithoutPreviousGeneration, sourceLogo) : savedWithoutPreviousGeneration;
        const savedWithGeneratedLogos = logos.reduce((savedLogos, logo) => saveGeneratedLogo(savedLogos, logo), savedWithSource);

        return {
          generatedLogoOptions: logos,
          logoGenerationStatus: status,
          logoGenerationMessage: message,
          selectedLogoId: firstLogo?.id ?? state.selectedLogoId,
          savedGeneratedLogoOptions: savedWithGeneratedLogos,
          brandWorkspaceHasPendingLocalChanges: firstLogo || sourceLogo ? true : state.brandWorkspaceHasPendingLocalChanges,
          logoGenerationIntent: "initial",
          logoRevisionRequest: "",
          logoRevisionSourceLogoId: undefined,
        };
      }),
    failLogoGeneration: (message) =>
      set({
        generatedLogoOptions: [],
        logoGenerationStatus: "error",
        logoGenerationMessage: message,
      }),
    setLogoGenerationMode: (mode) => set({ logoGenerationMode: mode }),
    selectLogoReferenceImage: (referenceImageId) => set({ selectedLogoReferenceImageId: referenceImageId }),
    startLogoRevision: (sourceLogoId) =>
      set((state) => {
        const sourceLogo = findGeneratedLogoInState(state, sourceLogoId);

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

        return {
          onboardingComplete: false,
          currentStep: "logoRevision",
          selectedLogoId: sourceLogoId,
          logoGenerationIntent: "revision",
          logoGenerationStatus: "idle",
          logoGenerationMessage: undefined,
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

      set({ currentStep: "generating", logoGenerationIntent: "revision" });
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
  };
}
