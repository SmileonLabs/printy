import type { StateCreator } from "zustand";
import { findBusinessCardTemplate } from "@/lib/business-card-templates";
import { findGeneratedLogoInState } from "@/lib/logo/generatedLogoLookup";
import { logoOptions } from "@/lib/mock-data";
import type { Brand, BusinessCardDraft, GeneratedLogoOption, OrderRecord } from "@/lib/types";
import { defaultMember, defaultOrderOptions, defaultPaymentMethod } from "@/store/printy-store-defaults";
import { saveGeneratedLogo } from "@/store/printy-store-generated-logos";
import { getCreatedDate, getDisplayDate, makeId } from "@/store/printy-store-id-date";
import { createOrderNumber, formatPrice, getOrderPriceAmount } from "@/store/printy-store-order";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyOnboardingActions = Pick<PrintyState, "setStep" | "saveBrandShell" | "ensureBusinessCardDraft" | "completeCheckout" | "startNewBrand">;

export function createPrintyOnboardingActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyOnboardingActions {
  return {
    setStep: (step, loginRedirectTarget) => {
      const currentStep = get().currentStep;

      if (step === "businessCardPreview" || step === "templateSelection") {
        get().ensureBusinessCardDraft();
      }

      set({
        currentStep: step,
        loginRedirectTarget: step === "login" ? loginRedirectTarget ?? "dashboard" : undefined,
        loginBackStep: step === "login" ? currentStep : undefined,
      });
    },
    saveBrandShell: () => {
      const state = get();
      const brandName = state.brandDraft.name.trim() || "새 브랜드";
      const designRequest = state.brandDraft.designRequest.trim();
      const existingBrand = state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined;
      const generatedLogoIds = state.generatedLogoOptions.map((logo) => logo.id);
      const logoIds = Array.from(new Set([state.selectedLogoId, ...generatedLogoIds, ...(existingBrand?.logoIds ?? [])]));
      const nextBrand: Brand = {
        id: existingBrand?.id ?? makeId("brand", state.brands.length),
        name: brandName,
        category: state.brandDraft.category,
        designRequest,
        selectedLogoId: state.selectedLogoId,
        logoIds,
        members: existingBrand?.members ?? [],
        createdAt: existingBrand?.createdAt ?? "방금 생성",
        assets: existingBrand?.assets ?? 1,
      };
      const generatedLogosToSave = state.generatedLogoOptions.length > 0 ? state.generatedLogoOptions : [findGeneratedLogoInState(state, state.selectedLogoId)].filter((logo): logo is GeneratedLogoOption => Boolean(logo));

      set((current) => ({
        brands: [nextBrand, ...current.brands.filter((brand) => brand.id !== nextBrand.id && brand.name !== nextBrand.name)],
        selectedBrandId: nextBrand.id,
        brandView: "list",
        activeBrandSection: "style",
        activeBusinessCardDraftId: undefined,
        savedGeneratedLogoOptions: generatedLogosToSave.reduce((savedLogos, logo) => saveGeneratedLogo(savedLogos, logo), current.savedGeneratedLogoOptions),
        logoGenerationTargetBrandId: undefined,
        brandWorkspaceHasPendingLocalChanges: true,
        brandWorkspaceOwnerUserId: current.isAuthenticated ? current.brandWorkspaceOwnerUserId : undefined,
      }));
    },
    ensureBusinessCardDraft: () => {
      const state = get();
      const existingDraft = state.activeBusinessCardDraftId ? state.businessCardDrafts.find((draft) => draft.id === state.activeBusinessCardDraftId) : undefined;
      const selectedTemplate = findBusinessCardTemplate(state.templates, state.selectedTemplateId);
      const nextDraft: BusinessCardDraft = {
        id: existingDraft?.id ?? makeId("card", state.businessCardDrafts.length),
        brandId: existingDraft?.brandId ?? state.selectedBrandId,
        brandName: state.brandDraft.name,
        category: state.brandDraft.category,
        designRequest: state.brandDraft.designRequest.trim(),
        selectedLogoId: state.selectedLogoId,
        templateId: existingDraft?.templateId ?? selectedTemplate?.id,
        member: { ...state.memberDraft },
        createdAt: existingDraft?.createdAt ?? getCreatedDate(),
      };

      set((current) => ({
        activeBusinessCardDraftId: nextDraft.id,
        businessCardDrafts: [nextDraft, ...current.businessCardDrafts.filter((draft) => draft.id !== nextDraft.id)],
        brandWorkspaceHasPendingLocalChanges: true,
        brandWorkspaceOwnerUserId: current.isAuthenticated ? current.brandWorkspaceOwnerUserId : undefined,
      }));

      return nextDraft;
    },
    completeCheckout: () => {
      const state = get();
      const draft = state.ensureBusinessCardDraft();
      const current = get();
      const existingBrand = current.brands.find((brand) => brand.id === draft.brandId || brand.name === state.brandDraft.name);
      const brandSelectedLogoId = existingBrand?.selectedLogoId ?? state.selectedLogoId;
      const nextBrand: Brand = {
        id: existingBrand?.id ?? makeId("brand", current.brands.length),
        name: state.brandDraft.name,
        category: state.brandDraft.category,
        designRequest: state.brandDraft.designRequest.trim(),
        selectedLogoId: brandSelectedLogoId,
        logoIds: Array.from(new Set([brandSelectedLogoId, state.selectedLogoId, ...(existingBrand?.logoIds ?? [])])),
        members: existingBrand?.members.length ? existingBrand.members : [state.memberDraft],
        createdAt: existingBrand?.createdAt ?? "방금 생성",
        assets: existingBrand ? Math.max(existingBrand.assets, 4) : 4,
      };
      const linkedDraft: BusinessCardDraft = {
        ...draft,
        brandId: nextBrand.id,
      };
      const selectedMemberIds = current.selectedBusinessCardMemberIds.length > 0 ? current.selectedBusinessCardMemberIds : [state.memberDraft.id];
      const selectedMembers = selectedMemberIds.map((memberId) => nextBrand.members.find((member) => member.id === memberId) ?? (state.memberDraft.id === memberId ? state.memberDraft : undefined)).filter((member): member is Brand["members"][number] => Boolean(member));
      const batchMembers = selectedMembers.length > 0 ? selectedMembers : [state.memberDraft];
      const unitPrice = getOrderPriceAmount(state.orderOptions);
      const createdAt = getDisplayDate();
      const linkedDrafts: BusinessCardDraft[] = batchMembers.map((member, index) => ({
        ...linkedDraft,
        id: index === 0 ? linkedDraft.id : makeId("card", current.businessCardDrafts.length + index),
        member,
        brandId: nextBrand.id,
      }));
      const nextOrders: OrderRecord[] = linkedDrafts.map((batchDraft, index) => ({
        id: makeId("order", current.orders.length + index),
        orderNumber: createOrderNumber(current.orders.length + index),
        title: `${batchDraft.member.name} 명함 ${state.orderOptions.quantity}매`,
        status: "paid",
        statusLabel: "결제 완료",
        price: formatPrice(unitPrice),
        quantity: state.orderOptions.quantity,
        paper: state.orderOptions.paper,
        paymentMethod: state.selectedPaymentMethod,
        createdAt,
        brandId: nextBrand.id,
        cardDraftId: batchDraft.id,
        templateId: batchDraft.templateId,
      }));

      set((latest) => ({
        brands: [nextBrand, ...latest.brands.filter((brand) => brand.id !== nextBrand.id && brand.name !== nextBrand.name)],
        businessCardDrafts: [...linkedDrafts, ...latest.businessCardDrafts.filter((cardDraft) => !linkedDrafts.some((nextDraft) => nextDraft.id === cardDraft.id))],
        orders: [...nextOrders, ...latest.orders],
        selectedBrandId: nextBrand.id,
        activeBusinessCardDraftId: linkedDrafts[0]?.id,
        lastOrderId: nextOrders[0]?.id,
        currentStep: "success",
        selectedBusinessCardMemberIds: [],
        brandWorkspaceHasPendingLocalChanges: true,
        brandWorkspaceOwnerUserId: latest.isAuthenticated ? latest.brandWorkspaceOwnerUserId : undefined,
      }));
    },
    startNewBrand: () =>
      set({
        onboardingComplete: false,
        currentStep: "brandCreation",
        brandView: "list",
        brandDraft: {
          name: "새 브랜드",
          category: "카페",
        designRequest: "",
        },
        selectedLogoId: logoOptions[0].id,
        selectedBrandId: undefined,
        generatedLogoOptions: [],
        logoGenerationStatus: "idle",
        logoGenerationMessage: undefined,
        logoGenerationMode: "manual",
        logoGenerationTargetBrandId: undefined,
        logoGenerationIntent: "initial",
        logoRevisionRequest: "",
        logoRevisionSourceLogoId: undefined,
        memberDraft: defaultMember,
        activeBusinessCardDraftId: undefined,
        lastOrderId: undefined,
        orderOptions: defaultOrderOptions,
        selectedPaymentMethod: defaultPaymentMethod,
        selectedBusinessCardMemberIds: [],
      }),
  };
}
