import type { StateCreator } from "zustand";
import { createBrandWorkspaceSignature, mergeBrandWorkspaces, type BrandWorkspace } from "@/lib/brand-workspace";
import { normalizeSelectableLogoId } from "@/store/printy-store-normalizers";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];

type PrintyWorkspaceActions = Pick<PrintyState, "syncBrandWorkspace" | "acknowledgeBrandWorkspaceSave">;

export function createPrintyWorkspaceActions(set: PrintyStoreSet): PrintyWorkspaceActions {
  return {
    syncBrandWorkspace: (workspace: BrandWorkspace, ownerUserId?: string) =>
      set((state) => {
        if (workspace.brands.length === 0 && state.brands.length > 0) {
          return {
            brandWorkspaceHasPendingLocalChanges: true,
            brandWorkspaceOwnerUserId: ownerUserId ?? state.brandWorkspaceOwnerUserId,
          };
        }

        const localWorkspace = { brands: state.brands, brandAssets: state.brandAssets, savedGeneratedLogoOptions: state.savedGeneratedLogoOptions, businessCardDrafts: state.businessCardDrafts, printProductDrafts: state.printProductDrafts, orders: state.orders };
        const shouldKeepPendingLocalChanges = state.brandWorkspaceHasPendingLocalChanges && (state.brandWorkspaceOwnerUserId === undefined || state.brandWorkspaceOwnerUserId === ownerUserId);
        const nextWorkspace = shouldKeepPendingLocalChanges ? mergeBrandWorkspaces(localWorkspace, workspace) : workspace;
        const deletedBusinessCardDraftIds = new Set(state.deletedBusinessCardDraftIds);
        const businessCardDrafts = nextWorkspace.businessCardDrafts.filter((draft) => !deletedBusinessCardDraftIds.has(draft.id));
        const selectedBrandId = nextWorkspace.brands.some((brand) => brand.id === state.selectedBrandId) ? state.selectedBrandId : undefined;
        const activeBusinessCardDraftId = businessCardDrafts.some((draft) => draft.id === state.activeBusinessCardDraftId) ? state.activeBusinessCardDraftId : undefined;
        const printProductDrafts = nextWorkspace.printProductDrafts.length > 0 ? nextWorkspace.printProductDrafts : state.printProductDrafts.filter((draft) => nextWorkspace.brands.some((brand) => brand.id === draft.brandId));
        const activePrintProductDraftId = printProductDrafts.some((draft) => draft.id === state.activePrintProductDraftId) ? state.activePrintProductDraftId : undefined;
        const lastOrderId = nextWorkspace.orders.some((order) => order.id === state.lastOrderId) ? state.lastOrderId : undefined;
        const selectedBrandLogoId = nextWorkspace.brands.find((brand) => brand.id === selectedBrandId)?.selectedLogoId;
        const activeDraftLogoId = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId)?.selectedLogoId;
        const fallbackLogoId = normalizeSelectableLogoId(selectedBrandLogoId, nextWorkspace.savedGeneratedLogoOptions, activeDraftLogoId);
        const selectedLogoId = normalizeSelectableLogoId(state.selectedLogoId, nextWorkspace.savedGeneratedLogoOptions, fallbackLogoId);

        return {
          brands: nextWorkspace.brands,
          brandAssets: nextWorkspace.brandAssets,
          savedGeneratedLogoOptions: nextWorkspace.savedGeneratedLogoOptions,
          businessCardDrafts,
          printProductDrafts,
          orders: nextWorkspace.orders,
          selectedLogoId,
          selectedBrandId,
          activeBusinessCardDraftId,
          activePrintProductDraftId,
          lastOrderId,
          brandView: selectedBrandId ? state.brandView : "list",
          brandWorkspaceHasPendingLocalChanges: shouldKeepPendingLocalChanges ? true : ownerUserId ? false : state.brandWorkspaceHasPendingLocalChanges,
          brandWorkspaceOwnerUserId: ownerUserId,
        };
      }),
    acknowledgeBrandWorkspaceSave: (savedSignature, ownerUserId) =>
      set((state) => {
        const authUserId = state.authSession?.userId;
        const currentSignature = createBrandWorkspaceSignature({
          brands: state.brands,
          brandAssets: state.brandAssets,
          savedGeneratedLogoOptions: state.savedGeneratedLogoOptions,
          businessCardDrafts: state.businessCardDrafts,
          printProductDrafts: state.printProductDrafts,
          orders: state.orders,
        });
        const ownerMatches = state.brandWorkspaceOwnerUserId === undefined || state.brandWorkspaceOwnerUserId === ownerUserId;

        if (authUserId !== ownerUserId || !ownerMatches || currentSignature !== savedSignature) {
          return { brandWorkspaceHasPendingLocalChanges: true };
        }

        return {
          brandWorkspaceHasPendingLocalChanges: false,
          brandWorkspaceOwnerUserId: ownerUserId,
        };
      }),
  };
}
