import type { StateCreator } from "zustand";
import { makeId } from "@/store/printy-store-id-date";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];

type PrintyDraftActions = Pick<PrintyState, "updateBrandDraft" | "updateMemberDraft" | "updateOrderOption" | "selectPaymentMethod" | "addBrandMember">;

export function createPrintyDraftActions(set: PrintyStoreSet): PrintyDraftActions {
  return {
    updateBrandDraft: (field, value) =>
      set((state) => ({
        brandDraft: { ...state.brandDraft, [field]: value },
      })),
    updateMemberDraft: (field, value) =>
      set((state) => ({
        memberDraft: { ...state.memberDraft, [field]: value },
      })),
    updateOrderOption: (field, value) =>
      set((state) => ({
        orderOptions: { ...state.orderOptions, [field]: value },
      })),
    selectPaymentMethod: (method) => set({ selectedPaymentMethod: method }),
    addBrandMember: (brandId, member) =>
      set((state) => {
        const brandIndex = state.brands.findIndex((brand) => brand.id === brandId);

        if (brandIndex < 0) {
          return {};
        }

        const brand = state.brands[brandIndex];
        const memberWithId = { ...member, id: makeId("member", brand.members.length) };
        const brands = [...state.brands];

        brands[brandIndex] = {
          ...brand,
          members: [...brand.members, memberWithId],
        };

        return {
          brands,
          brandWorkspaceHasPendingLocalChanges: true,
        };
      }),
  };
}
