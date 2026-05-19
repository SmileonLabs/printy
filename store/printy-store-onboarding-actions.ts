import type { StateCreator } from "zustand";
import { findGeneratedLogoInState } from "@/lib/logo/generatedLogoLookup";
import { logoOptions } from "@/lib/mock-data";
import type { Brand, BusinessCardDraft, GeneratedLogoOption, OrderRecord } from "@/lib/types";
import { defaultBrandDraft, defaultMember, defaultOrderOptions, defaultPaymentMethod, defaultShippingInfo } from "@/store/printy-store-defaults";
import { saveGeneratedLogo } from "@/store/printy-store-generated-logos";
import { getCreatedDate, getDisplayDate, makeId } from "@/store/printy-store-id-date";
import { createOrderNumber, formatPrice, getOrderPriceAmount } from "@/store/printy-store-order";
import type { PrintyState } from "@/store/printy-store-types";

type PrintyStoreSet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[0];
type PrintyStoreGet = Parameters<StateCreator<PrintyState, [], [], PrintyState>>[1];

type PrintyOnboardingActions = Pick<PrintyState, "setStep" | "saveBrandShell" | "ensureBusinessCardDraft" | "beginAiBusinessCardMockupGeneration" | "syncAiBusinessCardMockups" | "finishAiBusinessCardMockupGeneration" | "failAiBusinessCardMockupGeneration" | "dismissAiBusinessCardMockupNotice" | "selectAiBusinessCardMockup" | "deleteAiBusinessCardMockup" | "beginAiBusinessCardPdfGeneration" | "finishAiBusinessCardPdfGeneration" | "failAiBusinessCardPdfGeneration" | "dismissAiBusinessCardPdfNotice" | "completeCheckout" | "startNewBrand">;

export function createPrintyOnboardingActions(set: PrintyStoreSet, get: PrintyStoreGet): PrintyOnboardingActions {
  return {
    setStep: (step, loginRedirectTarget) => {
      const currentStep = get().currentStep;

      if (step === "businessCardPreview") {
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
      const brandName = state.brandDraft.name.trim();

      if (!brandName) {
        return;
      }

      const designRequest = state.brandDraft.designRequest.trim();
      const existingBrand = state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined;
      const generatedLogoIds = state.generatedLogoOptions.map((logo) => logo.id);
      const logoIds = Array.from(new Set([state.selectedLogoId, ...generatedLogoIds, ...(existingBrand?.logoIds ?? [])]));
      const nextBrand: Brand = {
        id: existingBrand?.id ?? makeId("brand", state.brands.length),
        name: brandName,
        category: state.brandDraft.category,
        designRequest,
        selectedLogoId: existingBrand?.selectedLogoId ?? state.selectedLogoId,
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
      const nextDraft: BusinessCardDraft = {
        id: existingDraft?.id ?? makeId("card", state.businessCardDrafts.length),
        brandId: existingDraft?.brandId ?? state.selectedBrandId,
        brandName: state.brandDraft.name,
        category: state.brandDraft.category,
        designRequest: state.brandDraft.designRequest.trim(),
        selectedLogoId: state.selectedLogoId,
        templateId: state.selectedTemplateId,
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
    beginAiBusinessCardMockupGeneration: (signature, message = "명함 목업 디자인을 만들고 있어요. 다른 페이지로 이동해도 완료되면 알림으로 알려드릴게요.") =>
      set((state) => ({
        aiBusinessCardMockupStatus: "generating",
        aiBusinessCardMockupMessage: message,
        aiBusinessCardMockupSignature: signature,
        aiBusinessCardMockups: state.aiBusinessCardMockupSignature === signature ? state.aiBusinessCardMockups : [],
        selectedAiBusinessCardMockupUrl: state.aiBusinessCardMockupSignature === signature ? state.selectedAiBusinessCardMockupUrl : undefined,
      })),
    syncAiBusinessCardMockups: (signature, mockups) =>
      set((state) => {
        if (state.aiBusinessCardMockupSignature === signature && state.aiBusinessCardMockupStatus === "generating") {
          return {};
        }

        if (mockups.length === 0) {
          return state.aiBusinessCardMockupSignature === signature ? {} : { aiBusinessCardMockupSignature: signature };
        }

        const nextMockups = state.aiBusinessCardMockupSignature === signature ? [...state.aiBusinessCardMockups] : [];

        for (const mockup of mockups) {
          if (!mockup.cleanImageUrl) {
            continue;
          }

          if (!nextMockups.some((item) => item.imageUrl === mockup.imageUrl)) {
            nextMockups.push(mockup);
          }
        }

        return {
          aiBusinessCardMockupStatus: "ready",
          aiBusinessCardMockupMessage: state.aiBusinessCardMockupSignature === signature ? state.aiBusinessCardMockupMessage : undefined,
          aiBusinessCardMockupSignature: signature,
          aiBusinessCardMockups: nextMockups,
          selectedAiBusinessCardMockupUrl: state.selectedAiBusinessCardMockupUrl ?? nextMockups[0]?.imageUrl,
        };
      }),
    finishAiBusinessCardMockupGeneration: (signature, mockups) =>
      set((state) => {
        if (state.aiBusinessCardMockupSignature !== signature) {
          return {};
        }

        const nextMockups = [...state.aiBusinessCardMockups];

        for (const mockup of mockups) {
          if (!mockup.cleanImageUrl) {
            continue;
          }

          if (!nextMockups.some((item) => item.imageUrl === mockup.imageUrl)) {
            nextMockups.push(mockup);
          }
        }

        return {
          aiBusinessCardMockupStatus: "ready",
          aiBusinessCardMockupMessage: mockups.length > 0 ? "명함 목업 디자인이 준비됐어요." : "생성된 명함 목업 디자인이 없어요.",
          aiBusinessCardMockups: nextMockups,
          selectedAiBusinessCardMockupUrl: mockups[0]?.imageUrl ?? state.selectedAiBusinessCardMockupUrl,
        };
      }),
    failAiBusinessCardMockupGeneration: (signature, message) =>
      set((state) => {
        if (state.aiBusinessCardMockupSignature !== signature) {
          return {};
        }

        return {
          aiBusinessCardMockupStatus: "failed",
          aiBusinessCardMockupMessage: message,
        };
      }),
    dismissAiBusinessCardMockupNotice: () => set({ aiBusinessCardMockupStatus: "idle", aiBusinessCardMockupMessage: undefined }),
    selectAiBusinessCardMockup: (imageUrl) => set({ selectedAiBusinessCardMockupUrl: imageUrl }),
    deleteAiBusinessCardMockup: (mockupId) => set((state) => {
      const mockup = state.aiBusinessCardMockups.find((item) => item.id === mockupId);

      if (!mockup) {
        return {};
      }

      const nextMockups = state.aiBusinessCardMockups.filter((item) => item.id !== mockupId);
      const nextRecords = Object.fromEntries(Object.entries(state.aiBusinessCardPdfRecords).filter(([signature]) => !signature.includes(`mockup:${mockup.imageUrl}`)));

      return {
        aiBusinessCardMockups: nextMockups,
        selectedAiBusinessCardMockupUrl: state.selectedAiBusinessCardMockupUrl === mockup.imageUrl ? nextMockups[0]?.imageUrl : state.selectedAiBusinessCardMockupUrl,
        aiBusinessCardMockupStatus: nextMockups.length > 0 ? state.aiBusinessCardMockupStatus : "idle",
        aiBusinessCardMockupMessage: nextMockups.length > 0 ? state.aiBusinessCardMockupMessage : undefined,
        aiBusinessCardPdfRecords: nextRecords,
        aiBusinessCardPdfStatus: state.aiBusinessCardPdfSignature?.includes(`mockup:${mockup.imageUrl}`) ? "idle" : state.aiBusinessCardPdfStatus,
        aiBusinessCardPdfMessage: state.aiBusinessCardPdfSignature?.includes(`mockup:${mockup.imageUrl}`) ? undefined : state.aiBusinessCardPdfMessage,
        aiBusinessCardPdfUrl: state.aiBusinessCardPdfSignature?.includes(`mockup:${mockup.imageUrl}`) ? undefined : state.aiBusinessCardPdfUrl,
        aiBusinessCardPdfFileName: state.aiBusinessCardPdfSignature?.includes(`mockup:${mockup.imageUrl}`) ? undefined : state.aiBusinessCardPdfFileName,
        aiBusinessCardPdfSignature: state.aiBusinessCardPdfSignature?.includes(`mockup:${mockup.imageUrl}`) ? undefined : state.aiBusinessCardPdfSignature,
      };
    }),
    beginAiBusinessCardPdfGeneration: (signature) => set((state) => ({
      aiBusinessCardPdfStatus: "generating",
      aiBusinessCardPdfMessage: "PDF 만드는 중... 다른 페이지로 이동해도 완료되면 알림으로 알려드릴게요.",
      aiBusinessCardPdfUrl: undefined,
      aiBusinessCardPdfFileName: undefined,
      aiBusinessCardPdfSignature: signature,
      aiBusinessCardPdfRecords: {
        ...state.aiBusinessCardPdfRecords,
        [signature]: { status: "generating", message: "PDF 만드는 중..." },
      },
    })),
    finishAiBusinessCardPdfGeneration: (signature, url, fileName) => set((state) => {
      if (state.aiBusinessCardPdfSignature !== signature) {
        return {
          aiBusinessCardPdfRecords: {
            ...state.aiBusinessCardPdfRecords,
            [signature]: { status: "ready", url, fileName, message: "인쇄용 양면 PDF가 준비됐어요." },
          },
        };
      }

      return {
        aiBusinessCardPdfStatus: "ready",
        aiBusinessCardPdfMessage: "인쇄용 양면 PDF가 준비됐어요. 해당 목업 카드에서 PDF 다운로드를 눌러 주세요.",
        aiBusinessCardPdfUrl: url,
        aiBusinessCardPdfFileName: fileName,
        aiBusinessCardPdfRecords: {
          ...state.aiBusinessCardPdfRecords,
          [signature]: { status: "ready", url, fileName, message: "인쇄용 양면 PDF가 준비됐어요." },
        },
      };
    }),
    failAiBusinessCardPdfGeneration: (message) => set((state) => ({
      aiBusinessCardPdfStatus: "failed",
      aiBusinessCardPdfMessage: message,
      aiBusinessCardPdfUrl: undefined,
      aiBusinessCardPdfFileName: undefined,
      aiBusinessCardPdfRecords: state.aiBusinessCardPdfSignature
        ? {
            ...state.aiBusinessCardPdfRecords,
            [state.aiBusinessCardPdfSignature]: { status: "failed", message },
          }
        : state.aiBusinessCardPdfRecords,
    })),
    dismissAiBusinessCardPdfNotice: () => set({ aiBusinessCardPdfMessage: undefined }),
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
      const shippingInfo = {
        recipientName: state.shippingInfo.recipientName.trim(),
        recipientPhone: state.shippingInfo.recipientPhone.trim(),
        address: state.shippingInfo.address.trim(),
        memo: state.shippingInfo.memo.trim(),
      };
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
        status: "pendingDeposit",
        statusLabel: "입금 대기",
        price: formatPrice(unitPrice),
        quantity: state.orderOptions.quantity,
        paper: state.orderOptions.paper,
        paymentMethod: state.selectedPaymentMethod,
        createdAt,
        brandId: nextBrand.id,
        cardDraftId: batchDraft.id,
        templateId: undefined,
        shippingInfo,
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
        shippingInfo,
        brandWorkspaceHasPendingLocalChanges: true,
        brandWorkspaceOwnerUserId: latest.isAuthenticated ? latest.brandWorkspaceOwnerUserId : undefined,
      }));
    },
    startNewBrand: () =>
      set({
        onboardingComplete: false,
        currentStep: "brandCreation",
        brandView: "list",
        brandDraft: defaultBrandDraft,
        brandLogoSetupMode: "generate",
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
        aiBusinessCardMockups: [],
        aiBusinessCardMockupStatus: "idle",
        aiBusinessCardMockupMessage: undefined,
        aiBusinessCardMockupSignature: undefined,
        selectedAiBusinessCardMockupUrl: undefined,
        aiBusinessCardPdfStatus: "idle",
        aiBusinessCardPdfMessage: undefined,
        aiBusinessCardPdfUrl: undefined,
        aiBusinessCardPdfFileName: undefined,
        aiBusinessCardPdfSignature: undefined,
        aiBusinessCardPdfRecords: {},
        lastOrderId: undefined,
        orderOptions: defaultOrderOptions,
        selectedPaymentMethod: defaultPaymentMethod,
        shippingInfo: defaultShippingInfo,
        selectedBusinessCardMemberIds: [],
      }),
  };
}
