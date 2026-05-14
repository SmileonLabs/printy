import type { StateCreator } from "zustand";
import { businessCardProductId } from "@/lib/business-card-templates";
import { defaultMember } from "@/store/printy-store-defaults";
import { getProductForSection } from "@/store/printy-store-products";
import type { BrandAsset } from "@/lib/types";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyCatalogActions = Pick<PrintyState, "startProduct" | "selectTemplate" | "addBrandAssets" | "setActiveBrandMockupJob" | "startBrandSectionProduction">;

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

      const selectedLogoId = draft?.selectedLogoId ?? brand.selectedLogoId;

      set({
        onboardingComplete: false,
        currentStep: draft ? "orderOptions" : "memberInput",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        memberDraft: brand.members[0] ?? defaultMember,
        selectedLogoId,
        selectedBrandId: brand.id,
        activeBusinessCardDraftId: draft?.id,
        selectedProductId: product.id,
        selectedTemplateId: draft?.templateId,
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
          ? state.businessCardDrafts.map((draft) => (draft.id === activeBusinessCardDraftId ? { ...draft, templateId } : draft))
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
    startBrandSectionProduction: (brandId, sectionId, memberIds) => {
      const state = get();
      const brand = state.brands.find((item) => item.id === brandId);
      const productId = getProductForSection(sectionId);
      const product = state.printProducts.find((item) => item.id === productId);

      if (!brand || !product || sectionId !== "cards" || product.productType !== "business-card") {
        return;
      }

      const selectedMemberIds = memberIds?.length ? memberIds : brand.members[0]?.id ? [brand.members[0].id] : [];
      const selectedMember = brand.members.find((member) => member.id === selectedMemberIds[0]);
      const draft = state.businessCardDrafts.find((item) => item.brandId === brand.id && (!selectedMember || item.member.id === selectedMember.id)) ?? state.businessCardDrafts.find((item) => item.brandId === brand.id);

      const selectedLogoId = draft?.selectedLogoId ?? brand.selectedLogoId;

      set({
        onboardingComplete: false,
        currentStep: selectedMemberIds.length > 0 ? "businessCardPreview" : draft ? "orderOptions" : "memberInput",
        brandDraft: { name: brand.name, category: brand.category, designRequest: brand.designRequest },
        memberDraft: selectedMember ?? brand.members[0] ?? defaultMember,
        selectedLogoId,
        selectedBrandId: brand.id,
        activeBusinessCardDraftId: draft?.id,
        selectedProductId: product.id,
        selectedTemplateId: draft?.templateId,
        selectedBusinessCardMemberIds: selectedMemberIds,
      });
    },
  };
}
