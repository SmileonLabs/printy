import type { StateCreator } from "zustand";
import type { PrintProductDraft } from "@/lib/types";
import { normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import { makeId } from "@/store/printy-store-id-date";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyPrintProductActions = Pick<PrintyState, "upsertPrintProductDraft" | "createPrintProductDraft" | "updatePrintProductDraftLayout" | "addPrintProductMockup" | "deletePrintProductDraft" | "deletePrintProductMockup" | "selectPrintProductMockup" | "completePrintProductDesign" | "savePrintProductPdf">;

function markWorkspaceDirty(state: PrintyState) {
  return {
    brandWorkspaceHasPendingLocalChanges: true,
    brandWorkspaceOwnerUserId: state.isAuthenticated ? state.brandWorkspaceOwnerUserId : undefined,
  };
}

export function createPrintyPrintProductActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyPrintProductActions {
  return {
    upsertPrintProductDraft: (draft) => set((state) => ({
      printProductDrafts: state.printProductDrafts.some((item) => item.id === draft.id) ? state.printProductDrafts.map((item) => (item.id === draft.id ? draft : item)) : [draft, ...state.printProductDrafts],
      activePrintProductDraftId: draft.id,
      ...markWorkspaceDirty(state),
    })),
    createPrintProductDraft: (brandId, productType, layout) => {
      const state = get();
      const brand = state.brands.find((item) => item.id === brandId);
      const adapter = printProductAdapters[productType];
      const now = new Date().toISOString();
      const draft: PrintProductDraft = {
        id: makeId("print-product-draft", state.printProductDrafts.length),
        brandId,
        productType,
        title: `${brand?.name ?? "브랜드"} ${adapter.shortTitle}`,
        request: "",
        layout: normalizePrintProductLayout(layout),
        mockups: [],
        createdAt: now,
        updatedAt: now,
      };

      get().upsertPrintProductDraft(draft);
      return draft;
    },
    updatePrintProductDraftLayout: (draftId, layout) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => (draft.id === draftId ? { ...draft, layout: normalizePrintProductLayout(layout), updatedAt: new Date().toISOString() } : draft)),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
    addPrintProductMockup: (draftId, mockup) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => (draft.id === draftId ? { ...draft, mockups: [mockup, ...draft.mockups.filter((item) => item.id !== mockup.id)], selectedMockupId: mockup.id, updatedAt: new Date().toISOString() } : draft)),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
    deletePrintProductDraft: (draftId) => set((state) => ({
      printProductDrafts: state.printProductDrafts.filter((draft) => draft.id !== draftId),
      activePrintProductDraftId: state.activePrintProductDraftId === draftId ? undefined : state.activePrintProductDraftId,
      ...markWorkspaceDirty(state),
    })),
    deletePrintProductMockup: (draftId, mockupId) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        const nextMockups = draft.mockups.filter((mockup) => mockup.id !== mockupId);

        return { ...draft, mockups: nextMockups, selectedMockupId: draft.selectedMockupId === mockupId ? nextMockups[0]?.id : draft.selectedMockupId, updatedAt: new Date().toISOString() };
      }),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
    selectPrintProductMockup: (draftId, mockupId) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => (draft.id === draftId ? { ...draft, selectedMockupId: mockupId, updatedAt: new Date().toISOString() } : draft)),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
    completePrintProductDesign: (draftId, mockupId) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        const selectedMockup = draft.mockups.find((mockup) => mockup.id === mockupId);

        if (!selectedMockup) {
          return draft;
        }

        const now = new Date().toISOString();

        return { ...draft, selectedMockupId: selectedMockup.id, completedMockupId: selectedMockup.id, completedAt: now, updatedAt: now };
      }),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
    savePrintProductPdf: (draftId, url, fileName) => set((state) => ({
      printProductDrafts: state.printProductDrafts.map((draft) => (draft.id === draftId ? { ...draft, pdfUrl: url, pdfFileName: fileName, updatedAt: new Date().toISOString() } : draft)),
      activePrintProductDraftId: draftId,
      ...markWorkspaceDirty(state),
    })),
  };
}
