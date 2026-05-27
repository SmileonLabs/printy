import type { StateCreator } from "zustand";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyNavigationActions = Pick<
  PrintyState,
  "setActiveTab" | "openNotifications" | "openBrandDetail" | "deleteBrand" | "closeBrandDetail" | "goBack" | "setBrandSection" | "startCardEdit"
>;

export function createPrintyNavigationActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyNavigationActions {
  return {
    setActiveTab: (tab) => set({ activeTab: tab, brandView: "list" }),
    openNotifications: () => set({ activeTab: "notifications", brandView: "list" }),
    openBrandDetail: (brandId) => set({ activeTab: "brands", selectedBrandId: brandId, brandView: "detail", activeBrandSection: "style" }),
    deleteBrand: (brandId) => set((state) => ({
      brands: state.brands.filter((brand) => brand.id !== brandId),
      brandAssets: state.brandAssets.filter((asset) => asset.brandId !== brandId),
      businessCardDrafts: state.businessCardDrafts.filter((draft) => draft.brandId !== brandId),
      printProductDrafts: state.printProductDrafts.filter((draft) => draft.brandId !== brandId),
      orders: state.orders.filter((order) => order.brandId !== brandId),
      selectedBrandId: state.selectedBrandId === brandId ? undefined : state.selectedBrandId,
      activeBusinessCardDraftId: state.businessCardDrafts.some((draft) => draft.id === state.activeBusinessCardDraftId && draft.brandId === brandId) ? undefined : state.activeBusinessCardDraftId,
      activePrintProductDraftId: state.printProductDrafts.some((draft) => draft.id === state.activePrintProductDraftId && draft.brandId === brandId) ? undefined : state.activePrintProductDraftId,
      lastOrderId: state.orders.some((order) => order.id === state.lastOrderId && order.brandId === brandId) ? undefined : state.lastOrderId,
      brandView: state.selectedBrandId === brandId ? "list" : state.brandView,
      activeBrandMockupJob: state.activeBrandMockupJob?.brandId === brandId ? undefined : state.activeBrandMockupJob,
      selectedBusinessCardMemberIds: state.selectedBrandId === brandId ? [] : state.selectedBusinessCardMemberIds,
      brandWorkspaceHasPendingLocalChanges: true,
      brandWorkspaceOwnerUserId: state.isAuthenticated ? state.brandWorkspaceOwnerUserId : undefined,
    })),
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
        case "logoUpload":
          if (state.logoGenerationTargetBrandId && state.isAuthenticated) {
            returnToDashboardHome();
            return;
          }

          set({ currentStep: "brandCreation" });
          return;
        case "generating":
          set({
            currentStep: state.logoGenerationIntent === "revision" ? "logoRevision" : state.logoGenerationIntent === "upload" ? "logoUpload" : "logoDirection",
            logoGenerationStatus: "idle",
            logoGenerationMessage: undefined,
            activeLogoGenerationJobId: undefined,
            logoGenerationIntent: state.logoGenerationIntent === "upload" ? "initial" : state.logoGenerationIntent,
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
          if (state.selectedBrandId && state.isAuthenticated) {
            returnToDashboardHome();
            return;
          }

          set({ currentStep: "logoSave" });
          return;
        case "orderOptions":
          set({ currentStep: "businessCardPreview" });
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
    startCardEdit: () => set({ onboardingComplete: false, currentStep: "businessCardPreview" }),
  };
}
