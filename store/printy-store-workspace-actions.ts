import type { StateCreator } from "zustand";
import { createBrandWorkspaceSignature, type BrandWorkspace } from "@/lib/brand-workspace";
import { normalizeSelectableLogoId } from "@/store/printy-store-normalizers";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];

type PrintyWorkspaceActions = Pick<PrintyState, "syncBrandWorkspace" | "acknowledgeBrandWorkspaceSave">;

export function createPrintyWorkspaceActions(set: PrintyStoreSet): PrintyWorkspaceActions {
  return {
    syncBrandWorkspace: (workspace: BrandWorkspace, ownerUserId?: string) =>
      set((state) => {
        const selectedBrandId = workspace.brands.some((brand) => brand.id === state.selectedBrandId) ? state.selectedBrandId : undefined;
        const activeBusinessCardDraftId = workspace.businessCardDrafts.some((draft) => draft.id === state.activeBusinessCardDraftId) ? state.activeBusinessCardDraftId : undefined;
        const lastOrderId = workspace.orders.some((order) => order.id === state.lastOrderId) ? state.lastOrderId : undefined;
        const selectedBrandLogoId = workspace.brands.find((brand) => brand.id === selectedBrandId)?.selectedLogoId;
        const activeDraftLogoId = workspace.businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId)?.selectedLogoId;
        const fallbackLogoId = normalizeSelectableLogoId(selectedBrandLogoId, workspace.savedGeneratedLogoOptions, activeDraftLogoId);
        const selectedLogoId = normalizeSelectableLogoId(state.selectedLogoId, workspace.savedGeneratedLogoOptions, fallbackLogoId);

        return {
          brands: workspace.brands,
          brandAssets: workspace.brandAssets,
          savedGeneratedLogoOptions: workspace.savedGeneratedLogoOptions,
          businessCardDrafts: workspace.businessCardDrafts,
          orders: workspace.orders,
          selectedLogoId,
          selectedBrandId,
          activeBusinessCardDraftId,
          lastOrderId,
          brandView: selectedBrandId ? state.brandView : "list",
          brandWorkspaceHasPendingLocalChanges: ownerUserId ? false : state.brandWorkspaceHasPendingLocalChanges,
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
