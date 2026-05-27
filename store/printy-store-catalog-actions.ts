import type { StateCreator } from "zustand";
import { businessCardProductId } from "@/lib/business-card-templates";
import { businessCardProductionSizeFields } from "@/lib/design-session";
import { defaultMember } from "@/store/printy-store-defaults";
import { getProductForSection } from "@/store/printy-store-products";
import type { BrandAsset } from "@/lib/types";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyCatalogActions = Pick<PrintyState, "startProduct" | "selectTemplate" | "addBrandAssets" | "setActiveBrandMockupJob" | "startBrandSectionProduction" | "updateBusinessCardProductionOptions">;

function mergeBrandAssets(currentAssets: BrandAsset[], nextAssets: BrandAsset[]) {
  const merged = new Map<string, BrandAsset>();

  for (const asset of currentAssets) {
    merged.set(asset.id, asset);
  }

  for (const asset of nextAssets) {
    merged.set(asset.id, asset);
  }

  return Array.from(merged.values());
}

export function createPrintyCatalogActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyCatalogActions {
  return {
    startProduct: (productId) => {
      const state = get();
      const product = state.printProducts.find((item) => item.id === productId);

      if (!product) {
        return;
      }

      if (product.productType !== "business-card") {
        return;
      }

      const brand = (state.selectedBrandId ? state.brands.find((item) => item.id === state.selectedBrandId) : undefined) ?? state.brands[0];

      if (!brand) {
        get().startNewBrand();
        return;
      }

      const draft = state.businessCardDrafts.find((item) => item.brandId === brand.id);

      set({
        onboardingComplete: false,
        currentStep: draft ? "orderOptions" : "memberInput",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        memberDraft: brand.members[0] ?? defaultMember,
        selectedLogoId: brand.selectedLogoId,
        selectedBrandId: brand.id,
        activeBusinessCardDraftId: draft?.id,
        selectedProductId: product.id,
        selectedTemplateId: undefined,
        businessCardProductionOptions: draft?.layout ? { ...state.businessCardProductionOptions, ...businessCardProductionSizeFields(undefined, draft.layout), layout: draft.layout } : state.businessCardProductionOptions,
        selectedBusinessCardMemberIds: brand.members[0]?.id ? [brand.members[0].id] : [],
      });
    },
    selectTemplate: (templateId) => {
      const template = get().templates.find((item) => item.id === templateId);
      const activeBusinessCardDraftId = get().activeBusinessCardDraftId;
      const shouldUpdateBusinessCardDraft = template?.productId === businessCardProductId && Boolean(activeBusinessCardDraftId);

      set((state) => ({
        selectedTemplateId: templateId,
        selectedProductId: template?.productId ?? state.selectedProductId,
        businessCardDrafts: shouldUpdateBusinessCardDraft
          ? state.businessCardDrafts.map((draft) => (draft.id === activeBusinessCardDraftId ? { ...draft, templateId, selectedLogoId: state.selectedLogoId } : draft))
          : state.businessCardDrafts,
        brandWorkspaceHasPendingLocalChanges: shouldUpdateBusinessCardDraft ? true : state.brandWorkspaceHasPendingLocalChanges,
        brandWorkspaceOwnerUserId: shouldUpdateBusinessCardDraft && !state.isAuthenticated ? undefined : state.brandWorkspaceOwnerUserId,
      }));
    },
    addBrandAssets: (brandId, assets) =>
      set((state) => ({
        brandAssets: mergeBrandAssets(state.brandAssets, assets.filter((asset) => asset.brandId === brandId)),
        brands: state.brands.map((brand) => (brand.id === brandId ? { ...brand, assets: Math.max(brand.assets, brand.assets + assets.length) } : brand)),
        brandWorkspaceHasPendingLocalChanges: assets.length > 0 ? true : state.brandWorkspaceHasPendingLocalChanges,
        brandWorkspaceOwnerUserId: assets.length > 0 && !state.isAuthenticated ? undefined : state.brandWorkspaceOwnerUserId,
      })),
    setActiveBrandMockupJob: (job) => set({ activeBrandMockupJob: job }),
    updateBusinessCardProductionOptions: (options) => set({ businessCardProductionOptions: options }),
    startBrandSectionProduction: (brandId, sectionId, memberIds, templateId, mode = "draft", editMember, editMockups, initialLayoutPrompt = "") => {
      const state = get();
      const brand = state.brands.find((item) => item.id === brandId);
      const productId = getProductForSection(sectionId);
      const product = state.printProducts.find((item) => item.id === productId);

      if (!brand || !product || sectionId !== "cards" || product.productType !== "business-card") {
        return;
      }

      const reusableDrafts = state.businessCardDrafts.filter((item) => item.brandId === brand.id && !item.completedMockupSignature);
      const explicitDraft = mode === "draft" && editMockups?.draftId ? reusableDrafts.find((item) => item.id === editMockups.draftId) : undefined;
      const selectedMemberIds = memberIds?.length ? memberIds : explicitDraft?.member.id ? [explicitDraft.member.id] : brand.members[0]?.id ? [brand.members[0].id] : [];
      const selectedMember = brand.members.find((member) => member.id === selectedMemberIds[0]) ?? (mode === "draft" ? explicitDraft?.member : undefined) ?? (mode === "edit" ? editMember : undefined);
      const draft = mode === "draft" ? explicitDraft ?? reusableDrafts.find((item) => !selectedMember || item.member.id === selectedMember.id) ?? reusableDrafts[0] : undefined;
      const isEditModeWithMockups = mode === "edit" && Boolean(editMockups?.mockups.length);
      const editDraft = isEditModeWithMockups ? state.businessCardDrafts.find((item) => item.id === editMockups?.draftId && item.brandId === brand.id) ?? state.businessCardDrafts.find((item) => item.brandId === brand.id && item.completedMockupSignature === editMockups?.signature && (!selectedMember || item.member.id === selectedMember.id)) : undefined;
      const selectedLogoId = draft?.selectedLogoId ?? editDraft?.selectedLogoId ?? brand.selectedLogoId;
      const nextBusinessCardProductionOptions = draft?.layout
        ? { ...state.businessCardProductionOptions, ...businessCardProductionSizeFields(undefined, draft.layout), layout: draft.layout }
        : mode === "edit"
          ? state.businessCardProductionOptions
          : { ...state.businessCardProductionOptions, layout: undefined };

      set({
        onboardingComplete: false,
        currentStep: selectedMemberIds.length > 0 ? "businessCardPreview" : draft ? "orderOptions" : "memberInput",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        memberDraft: selectedMember ?? brand.members[0] ?? defaultMember,
        selectedLogoId,
        selectedBrandId: brand.id,
        activeBusinessCardDraftId: draft?.id ?? editDraft?.id,
        businessCardEditorMode: mode === "edit" ? "edit" : "create",
        selectedProductId: product.id,
        selectedTemplateId: templateId,
        pendingBusinessCardLayoutPrompt: mode === "edit" ? "" : initialLayoutPrompt.trim(),
        businessCardProductionOptions: nextBusinessCardProductionOptions,
        selectedBusinessCardMemberIds: selectedMemberIds,
        aiBusinessCardMockupStatus: isEditModeWithMockups ? "ready" : "idle",
        aiBusinessCardMockupMessage: isEditModeWithMockups ? "저장된 명함 목업 디자인을 불러왔어요." : undefined,
        aiBusinessCardMockupSignature: isEditModeWithMockups && editMockups?.signature ? editMockups.signature : undefined,
        aiBusinessCardMockups: isEditModeWithMockups && editMockups ? editMockups.mockups : [],
        selectedAiBusinessCardMockupUrl: isEditModeWithMockups && editMockups ? editMockups.selectedImageUrl ?? editMockups.mockups[0]?.imageUrl : undefined,
        activeAiBusinessCardMockupJobId: undefined,
      });
    },
  };
}
