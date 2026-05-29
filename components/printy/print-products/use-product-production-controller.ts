"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadBlob, readDownloadFileName } from "@/lib/client/download";
import { startAiRequestStatusTicker } from "@/lib/client/ai-request-status";
import { fetchWithTimeout, readApiReason } from "@/lib/client/fetch";
import { createBrandWorkspaceSignature } from "@/lib/brand-workspace";
import { designSessionMessage, editSessionTitle } from "@/lib/design-session";
import { applyPrintProductSize, createDefaultPrintProductLayout, normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import type { Brand, BrandAsset, PrintProductDraft, PrintProductMockup, PrintProductProductionLayout, PrintProductProductionType, ResolvedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type LogoWithImage = Extract<ResolvedLogoOption, { imageUrl: string }>;
type PendingPrintProductRequest = { draftId: string; expiresAt: number };

const printProductMockupPendingTtlMs = 2 * 60 * 1000;

function logoHasImage(logo: ResolvedLogoOption): logo is LogoWithImage {
  return "imageUrl" in logo;
}

function findDraft(drafts: PrintProductDraft[], brandId: string, productType: PrintProductProductionType, activeDraftId: string | undefined, includeCompletedActiveDraft: boolean) {
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId && draft.brandId === brandId && draft.productType === productType);

  if (activeDraft && (includeCompletedActiveDraft || !activeDraft.completedAt)) {
    return activeDraft;
  }

  const productDrafts = drafts.filter((draft) => draft.brandId === brandId && draft.productType === productType && !draft.completedAt);

  return productDrafts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function hasBrandAsset(value: unknown): value is BrandAsset {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string" && "brandId" in value && typeof value.brandId === "string";
}

function pendingMockupRequestKey(brandId: string, productType: PrintProductProductionType) {
  return `printy:print-product-mockup:${brandId}:${productType}`;
}

function readPendingMockupRequest(key: string): PendingPrintProductRequest | undefined {
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return undefined;
  }

  const value: unknown = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  })();

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as { draftId?: unknown; expiresAt?: unknown };

  if (typeof record.draftId !== "string" || typeof record.expiresAt !== "number") {
    return undefined;
  }

  return record.expiresAt > Date.now() ? { draftId: record.draftId, expiresAt: record.expiresAt } : undefined;
}

function readLatestPrintProductDraft(draftId: string, fallback: PrintProductDraft) {
  return usePrintyStore.getState().printProductDrafts.find((item) => item.id === draftId) ?? fallback;
}

async function savePrintProductDraftPatch(draft: PrintProductDraft, assets: BrandAsset[] = []) {
  const response = await fetch("/api/print-products/drafts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, assets }),
  });

  if (!response.ok) {
    throw new Error("완료 디자인을 서버에 저장하지 못했어요. 다시 저장해 주세요.");
  }
}

function acknowledgeCurrentPrintProductPatchSave(ownerUserId: string) {
  const state = usePrintyStore.getState();
  const savedSignature = createBrandWorkspaceSignature({
    brands: state.brands,
    brandAssets: state.brandAssets,
    savedGeneratedLogoOptions: state.savedGeneratedLogoOptions,
    businessCardDrafts: state.businessCardDrafts,
    printProductDrafts: state.printProductDrafts,
    orders: state.orders,
  });

  state.acknowledgeBrandWorkspaceSave(savedSignature, ownerUserId);
}

export function useProductProductionController(brand: Brand, productType: PrintProductProductionType, logo: ResolvedLogoOption) {
  const adapter = printProductAdapters[productType];
  const drafts = usePrintyStore((state) => state.printProductDrafts);
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const authUserId = usePrintyStore((state) => state.authSession?.userId);
  const activePrintProductDraftId = usePrintyStore((state) => state.activePrintProductDraftId);
  const addBrandAssets = usePrintyStore((state) => state.addBrandAssets);
  const createPrintProductDraft = usePrintyStore((state) => state.createPrintProductDraft);
  const upsertPrintProductDraft = usePrintyStore((state) => state.upsertPrintProductDraft);
  const updateLayout = usePrintyStore((state) => state.updatePrintProductDraftLayout);
  const deleteMockup = usePrintyStore((state) => state.deletePrintProductMockup);
  const deleteDraft = usePrintyStore((state) => state.deletePrintProductDraft);
  const selectMockup = usePrintyStore((state) => state.selectPrintProductMockup);
  const savePdf = usePrintyStore((state) => state.savePrintProductPdf);
  const [status, setStatus] = useState("");
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingLayout, setIsGeneratingLayout] = useState(false);
  const [layoutPrompt, setLayoutPrompt] = useState("");
  const [mockupPrompt, setMockupPrompt] = useState("");
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string>();
  const [referenceImageName, setReferenceImageName] = useState("");
  const [draftOverride, setDraftOverride] = useState<PrintProductDraft>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const storeDraft = findDraft(drafts, brand.id, productType, activePrintProductDraftId, editorMode === "edit");
  const latestDraftOverride = draftOverride ? drafts.find((item) => item.id === draftOverride.id) ?? draftOverride : undefined;
  const resolvedDraftOverride = latestDraftOverride && (editorMode === "edit" || !latestDraftOverride.completedAt) ? latestDraftOverride : undefined;
  const draft = resolvedDraftOverride ?? storeDraft;
  const selectedMockup = draft?.mockups.find((mockup) => mockup.id === draft.selectedMockupId) ?? draft?.mockups[0];
  const layout = normalizePrintProductLayout(draft?.layout ?? createDefaultPrintProductLayout(productType, brand, brand.members));
  const logoImageUrl = logoHasImage(logo) ? logo.imageUrl : undefined;
  const logoVectorSvgUrl = logoHasImage(logo) ? logo.vectorSvgUrl : undefined;
  const canUseLogo = Boolean(logoImageUrl);
  const existingDrafts = useMemo(() => drafts.filter((item) => item.brandId === brand.id && item.productType === productType), [brand.id, drafts, productType]);
  const temporaryDrafts = useMemo(() => existingDrafts.filter((item) => !item.completedAt).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [existingDrafts]);
  const completedDrafts = useMemo(() => existingDrafts.filter((item) => item.completedAt).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [existingDrafts]);
  const pendingMockupKey = pendingMockupRequestKey(brand.id, productType);

  useEffect(() => {
    setIsEditorOpen(false);
    setEditorMode("create");
    setMockupPrompt("");
    setReferenceImageDataUrl(undefined);
    setReferenceImageName("");
    setDraftOverride(undefined);
    setLayoutPrompt("");
    setStatus("");
  }, [brand.id, productType]);

  useEffect(() => {
    const pending = readPendingMockupRequest(pendingMockupKey);

    if (!pending) {
      window.localStorage.removeItem(pendingMockupKey);
      return;
    }

    setIsGeneratingMockup(true);
    setStatus("AI 디자인 요청이 진행 중이에요. 완료되면 토스트로 알려드릴게요.");

    const timeout = window.setTimeout(() => {
      window.localStorage.removeItem(pendingMockupKey);
      setIsGeneratingMockup(false);
      setStatus("AI 디자인 요청이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.");
    }, Math.max(pending.expiresAt - Date.now(), 0));

    return () => window.clearTimeout(timeout);
  }, [pendingMockupKey]);

  const ensureDraft = () => draft ?? createPrintProductDraft(brand.id, productType, layout);

  const mockupRequestBody = (current: PrintProductDraft, promptOverride?: string, promptOnly = false) => ({ brandId: brand.id, brandName: brand.name, category: brand.category, productType, request: current.request, layout: normalizePrintProductLayout(current.layout), promptOverride, promptOnly, referenceImageDataUrl });

  const saveLayout = () => {
    const current = ensureDraft();
    const latestDraft = readLatestPrintProductDraft(current.id, current);

    upsertPrintProductDraft({ ...latestDraft, layout: normalizePrintProductLayout(latestDraft.layout), updatedAt: new Date().toISOString() });
    setStatus(`${adapter.title} 레이아웃을 임시 저장했어요.`);
  };

  const startNewDesign = () => {
    const nextLayout = createDefaultPrintProductLayout(productType, brand, brand.members);
    const nextDraft = createPrintProductDraft(brand.id, productType, nextLayout);

    setDraftOverride(nextDraft);
    setMockupPrompt("");
    setEditorMode("create");
    setIsEditorOpen(true);
    setStatus(designSessionMessage(adapter.shortTitle, "new"));
  };

  const startNewDesignWithAiLayout = async () => {
    const prompt = layoutPrompt.trim();

    if (!prompt) {
      startNewDesign();
      return;
    }

    const baseLayout = createDefaultPrintProductLayout(productType, brand, brand.members);

    setIsGeneratingLayout(true);
    setStatus("GPT가 1차 레이아웃을 만들고 있어요.");

    try {
      const response = await fetchWithTimeout("/api/print-products/layout-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, brandName: brand.name, category: brand.category, productType, baseLayout }),
      }, 30_000);
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok || typeof payload !== "object" || payload === null || !("layout" in payload)) {
        throw new Error(readApiReason(payload, "GPT 레이아웃을 만들지 못했어요."));
      }

      const nextLayout = normalizePrintProductLayout(payload.layout as PrintProductProductionLayout);
      const nextDraft = createPrintProductDraft(brand.id, productType, nextLayout);

      setDraftOverride(nextDraft);
      upsertPrintProductDraft({ ...nextDraft, layout: nextLayout, updatedAt: new Date().toISOString() });
      setMockupPrompt("");
      setEditorMode("create");
      setIsEditorOpen(true);
      setStatus("GPT 1차 레이아웃을 편집창에 적용했어요.");
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "GPT 레이아웃 요청 시간이 초과됐어요. 다시 시도해 주세요." : error instanceof Error ? error.message : "GPT 레이아웃을 만들지 못했어요.");
    } finally {
      setIsGeneratingLayout(false);
    }
  };

  const loadDraft = (targetDraft: PrintProductDraft) => {
    setDraftOverride(targetDraft);
    upsertPrintProductDraft(targetDraft);
    setMockupPrompt("");
    setEditorMode("create");
    setIsEditorOpen(true);
    setStatus(designSessionMessage(adapter.shortTitle, "draft", targetDraft.title));
  };
  const removeDraft = (targetDraft: PrintProductDraft) => {
    const message = targetDraft.completedAt ? "완료 저장한 디자인을 삭제할까요?" : "임시 저장한 디자인을 삭제할까요?";

    if (!window.confirm(message)) {
      return;
    }

    deleteDraft(targetDraft.id);
    setIsEditorOpen(false);
    setStatus(targetDraft.completedAt ? "완료 저장한 디자인을 삭제했어요." : "임시 저장한 디자인을 삭제했어요.");
  };

  const editCompletedDraft = (targetDraft: PrintProductDraft) => {
    const editDraft = { ...targetDraft, title: editSessionTitle(targetDraft.title), updatedAt: new Date().toISOString() };

    setDraftOverride(editDraft);
    upsertPrintProductDraft(editDraft);
    setMockupPrompt("");
    setEditorMode("edit");
    setIsEditorOpen(true);
    setStatus(designSessionMessage(adapter.shortTitle, "edit", targetDraft.title));
  };

  const completeSelectedDesign = async () => {
    const current = ensureDraft();
    const latestDraft = readLatestPrintProductDraft(current.id, current);
    const latestSelectedMockup = latestDraft.mockups.find((mockup) => mockup.id === latestDraft.selectedMockupId) ?? latestDraft.mockups[0];

    if (!latestSelectedMockup) {
      setStatus("완료 저장할 배경 후보를 먼저 만들어 선택해 주세요.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const completedDraft = { ...latestDraft, layout: normalizePrintProductLayout(latestDraft.layout), selectedMockupId: latestSelectedMockup.id, completedMockupId: latestSelectedMockup.id, completedAt: now, updatedAt: now };

      if (isAuthenticated && authUserId) {
        setStatus("완료 디자인을 서버에 저장하고 있어요.");
        await savePrintProductDraftPatch(completedDraft);
      }
      upsertPrintProductDraft(completedDraft);
      if (isAuthenticated && authUserId) {
        acknowledgeCurrentPrintProductPatchSave(authUserId);
      }
      setIsEditorOpen(false);
      setStatus(`선택한 ${adapter.shortTitle} 디자인을 완료 저장했어요.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "완료 디자인을 저장하지 못했어요. 다시 저장해 주세요.");
    }
  };

  const previewMockupPrompt = async () => {
    const current = ensureDraft();
    const latestDraft = readLatestPrintProductDraft(current.id, current);

    setIsGeneratingMockup(true);
    setStatus("AI에 전송할 최종 프롬프트를 만들고 있어요.");

    try {
      const response = await fetchWithTimeout("/api/print-products/mockup-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockupRequestBody(latestDraft)),
      }, 20_000);
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok || typeof payload !== "object" || payload === null || !("prompt" in payload) || typeof payload.prompt !== "string") {
        throw new Error(readApiReason(payload, "최종 프롬프트를 만들지 못했어요."));
      }

      setMockupPrompt(payload.prompt);
      setStatus("최종 프롬프트를 확인하고 필요하면 수정한 뒤 전송해 주세요.");
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "최종 프롬프트 요청 시간이 초과됐어요. 다시 시도해 주세요." : error instanceof Error ? error.message : "최종 프롬프트를 만들지 못했어요.");
    } finally {
      setIsGeneratingMockup(false);
    }
  };

  const sendMockupPrompt = async () => {
    const current = ensureDraft();
    const requestDraft = readLatestPrintProductDraft(current.id, current);
    const finalPrompt = mockupPrompt.trim();

    setIsGeneratingMockup(true);
    setStatus("AI 배경 후보를 만들고 있어요.");
    const stopStatusTicker = startAiRequestStatusTicker({ label: `${adapter.shortTitle} AI 디자인 요청은`, phase: "running", onStatus: setStatus });
    window.localStorage.setItem(pendingMockupKey, JSON.stringify({ draftId: requestDraft.id, expiresAt: Date.now() + printProductMockupPendingTtlMs } satisfies PendingPrintProductRequest));

    try {
      const response = await fetchWithTimeout("/api/print-products/mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockupRequestBody(requestDraft, finalPrompt || undefined)),
      }, 90_000);
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok || typeof payload !== "object" || payload === null || !("mockup" in payload)) {
        throw new Error(readApiReason(payload, "AI 배경 후보를 만들지 못했어요."));
      }

      const result = payload as { mockup: PrintProductMockup; asset?: unknown };
      const latestDraft = readLatestPrintProductDraft(requestDraft.id, requestDraft);
      const nextMockups = [result.mockup, ...latestDraft.mockups.filter((mockup) => mockup.id !== result.mockup.id)];
      const now = new Date().toISOString();
      const completedDraft = { ...latestDraft, mockups: nextMockups, selectedMockupId: result.mockup.id, completedMockupId: result.mockup.id, completedAt: now, updatedAt: now };

      if (isAuthenticated && authUserId) {
        setStatus("완료 디자인을 서버에 저장하고 있어요.");
        await savePrintProductDraftPatch(completedDraft, hasBrandAsset(result.asset) ? [result.asset] : []);
      }
      upsertPrintProductDraft(completedDraft);
      if (hasBrandAsset(result.asset)) {
        addBrandAssets(brand.id, [result.asset]);
      }
      if (isAuthenticated && authUserId) {
        acknowledgeCurrentPrintProductPatchSave(authUserId);
      }

      setMockupPrompt("");
      setReferenceImageDataUrl(undefined);
      setReferenceImageName("");
      setEditorMode("edit");
      setIsEditorOpen(true);
      window.localStorage.removeItem(pendingMockupKey);
      setStatus(`${adapter.shortTitle} 디자인을 완료 저장하고 수정 화면으로 열었어요.`);
    } catch (error) {
      window.localStorage.removeItem(pendingMockupKey);
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "AI 배경 생성 시간이 초과됐어요. 잠시 후 다시 시도해 주세요." : error instanceof Error ? error.message : "AI 배경 후보를 만들지 못했어요.");
    } finally {
      stopStatusTicker();
      setIsGeneratingMockup(false);
    }
  };

  const generatePdf = async (targetDraft = draft) => {
    const current = targetDraft ?? ensureDraft();
    const latestDraft = readLatestPrintProductDraft(current.id, current);
    const currentMockup = latestDraft.mockups.find((mockup) => mockup.id === latestDraft.selectedMockupId) ?? latestDraft.mockups[0];
    const currentLayout = normalizePrintProductLayout(latestDraft.layout);

    setIsGeneratingPdf(true);
    setStatus("인쇄용 PDF를 만들고 있어요.");

    try {
      const response = await fetch("/api/print-products/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: brand.name, productType, layout: currentLayout, backgroundImageUrl: currentMockup?.cleanImageUrl ?? currentMockup?.imageUrl, logoImageUrl, logoVectorSvgUrl }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => undefined);
        throw new Error(readApiReason(payload, "PDF를 만들지 못했어요."));
      }

      const blob = await response.blob();
      const fileName = readDownloadFileName(response, `${brand.name}-${productType}.pdf`);

      downloadBlob(blob, fileName);
      savePdf(latestDraft.id, URL.createObjectURL(blob), fileName);
      setStatus("PDF 다운로드를 시작했어요.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "PDF를 만들지 못했어요.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const updateCurrentLayout = (nextLayout: PrintProductProductionLayout) => updateLayout(ensureDraft().id, nextLayout);
  const updateSize = (sizeId: string) => updateCurrentLayout(applyPrintProductSize(layout, sizeId));
  const updateRequest = (value: string) => upsertPrintProductDraft({ ...(draft ?? ensureDraft()), request: value, updatedAt: new Date().toISOString() });

  return {
    adapter,
    draft,
    selectedMockup,
    layout,
    logoImageUrl,
    logoVectorSvgUrl,
    canUseLogo,
    temporaryDrafts,
    completedDrafts,
    status,
    isGeneratingMockup,
    isGeneratingPdf,
    isGeneratingLayout,
    layoutPrompt,
    mockupPrompt,
    editorMode,
    isEditorOpen,
    setIsEditorOpen,
    setMockupPrompt,
    referenceImageDataUrl,
    referenceImageName,
    setReferenceImageDataUrl,
    setReferenceImageName,
    setLayoutPrompt,
    clearStatus: () => setStatus(""),
    saveLayout,
    startNewDesign,
    startNewDesignWithAiLayout,
    loadDraft,
    editCompletedDraft,
    completeSelectedDesign,
    previewMockupPrompt,
    sendMockupPrompt,
    generatePdf,
    updateCurrentLayout,
    updateSize,
    updateRequest,
    selectMockup,
    deleteMockup,
    deleteDraft: removeDraft,
  };
}
