import type { StateCreator } from "zustand";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyNavigationActions = Pick<
  PrintyState,
  "setActiveTab" | "openNotifications" | "openBrandDetail" | "closeBrandDetail" | "goBack" | "setBrandSection" | "startCardEdit"
>;

export function createPrintyNavigationActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyNavigationActions {
  return {
    setActiveTab: (tab) => set({ activeTab: tab, brandView: "list" }),
    openNotifications: () => set({ activeTab: "notifications", brandView: "list" }),
    openBrandDetail: (brandId) => set({ activeTab: "brands", selectedBrandId: brandId, brandView: "detail", activeBrandSection: "style" }),
    closeBrandDetail: () => set({ activeTab: "brands", brandView: "list" }),
    goBack: () => {
      const state = get();

      if (state.onboardingComplete && state.isAuthenticated) {
        if (state.activeTab === "brands" && state.brandView === "detail") {
          state.closeBrandDetail();
          return;
        }

        if (state.activeTab !== "home") {
          state.setActiveTab("home");
        }

        return;
      }

      if (state.currentStep === "home") {
        return;
      }

      const returnToDashboardHome = () =>
        set({
          onboardingComplete: true,
          currentStep: "home",
          activeTab: "home",
          brandView: "list",
          activeBrandSection: "style",
        });

      switch (state.currentStep) {
        case "brandCreation":
          if (state.isAuthenticated) {
            returnToDashboardHome();
            return;
          }

          set({ currentStep: "home" });
          return;
        case "logoDirection":
          set({ currentStep: "brandCreation" });
          return;
        case "generating":
          set({
            currentStep: state.logoGenerationIntent === "revision" ? "logoRevision" : "logoDirection",
            logoGenerationStatus: "idle",
            logoGenerationMessage: undefined,
          });
          return;
        case "logoSelection":
          set({ currentStep: "logoDirection" });
          return;
        case "logoRevision":
          state.cancelLogoRevision();
          return;
        case "logoSave":
          set({ currentStep: "logoSelection" });
          return;
        case "login":
          set({
            currentStep: state.loginBackStep ?? (state.loginRedirectTarget === "checkout" ? "orderOptions" : "home"),
            loginRedirectTarget: undefined,
            loginBackStep: undefined,
          });
          return;
        case "memberInput":
          if (state.selectedBrandId && state.isAuthenticated) {
            returnToDashboardHome();
            return;
          }

          set({ currentStep: "logoSave" });
          return;
        case "businessCardPreview":
          set({ currentStep: "memberInput" });
          return;
        case "businessCardBatchPreview":
          set({ currentStep: "businessCardPreview" });
          return;
        case "orderOptions":
          set({ currentStep: "businessCardBatchPreview" });
          return;
        case "templateSelection":
          set({ currentStep: "orderOptions" });
          return;
        case "checkout":
          set({ currentStep: "orderOptions" });
          return;
        case "success":
          returnToDashboardHome();
          return;
      }
    },
    setBrandSection: (sectionId) => set({ activeBrandSection: sectionId }),
    startCardEdit: () => set({ onboardingComplete: false, currentStep: "memberInput" }),
  };
}
