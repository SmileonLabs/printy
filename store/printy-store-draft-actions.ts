import { orderStatusLabel } from "@/lib/order-status";
import type { StateCreator } from "zustand";
import { makeId } from "@/store/printy-store-id-date";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];

type PrintyDraftActions = Pick<PrintyState, "updateBrandDraft" | "updateMemberDraft" | "updateOrderOption" | "selectPaymentMethod" | "updateShippingInfo" | "addBrandMember" | "updateBrandMember" | "deleteBrandMember" | "cancelOrder">;

type PrintyDraftActionsWithCompletedMockup = Pick<PrintyState, "setBusinessCardDraftCompletedMockupCleanImageUrl">;

export function createPrintyDraftActions(set: PrintyStoreSet): PrintyDraftActions & PrintyDraftActionsWithCompletedMockup {
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
    updateShippingInfo: (field, value) =>
      set((state) => ({
        shippingInfo: { ...state.shippingInfo, [field]: value },
      })),
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
    updateBrandMember: (brandId, memberId, member) =>
      set((state) => ({
        brands: state.brands.map((brand) => (brand.id === brandId ? { ...brand, members: brand.members.map((item) => (item.id === memberId ? { ...member, id: memberId } : item)) } : brand)),
        businessCardDrafts: state.businessCardDrafts.map((draft) => (draft.brandId === brandId && draft.member.id === memberId ? { ...draft, member: { ...member, id: memberId } } : draft)),
        brandWorkspaceHasPendingLocalChanges: true,
      })),
    deleteBrandMember: (brandId, memberId) =>
      set((state) => ({
        brands: state.brands.map((brand) => (brand.id === brandId ? { ...brand, members: brand.members.filter((member) => member.id !== memberId) } : brand)),
        brandWorkspaceHasPendingLocalChanges: true,
      })),
    cancelOrder: (orderId) =>
      set((state) => ({
        orders: state.orders.map((order) => (order.id === orderId && order.status === "pendingDeposit" ? { ...order, status: "cancelled", statusLabel: orderStatusLabel("cancelled") } : order)),
        brandWorkspaceHasPendingLocalChanges: true,
      })),

    setBusinessCardDraftCompletedMockupCleanImageUrl: (draftId, cleanImageUrl) =>
      set((state) => ({
        businessCardDrafts: state.businessCardDrafts.map((draft) => (draft.id === draftId && draft.completedMockup ? { ...draft, completedMockup: { ...draft.completedMockup, cleanImageUrl } } : draft)),
        brandWorkspaceHasPendingLocalChanges: true,
      })),
  };
}
