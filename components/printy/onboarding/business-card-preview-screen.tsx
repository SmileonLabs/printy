"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessCardLayoutBuilder, BusinessCardUserPreview } from "@/components/admin/business-card-layout-builder";
import { ProductionAiDesignRequestCard, ProductionSizeCard } from "@/components/design-production/production-editor-cards";
import { findGeneratedLogoFromState } from "@/components/printy/logo/logo-state";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { ToastNotice, ToastNoticeViewport, type ToastNoticeTone } from "@/components/printy/shared/toast-notice";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { createAiBusinessCardMockupSignature, createAiBusinessCardRequestBody } from "@/lib/ai-business-card/client";
import { createBrandWorkspaceSignature, readBrandWorkspace, type BrandWorkspace } from "@/lib/brand-workspace";
import { aiRequestStatusIntervalMs, createAiRequestStatusMessage, startAiRequestStatusTicker } from "@/lib/client/ai-request-status";
import { businessCardProductionSizeFields, businessCardSizeOptions, createSizedBusinessCardLayout, resolveBusinessCardSize, sizeBusinessCardLayout } from "@/lib/design-session";
import { getBusinessCardLayoutOrientation, layoutForBusinessCardOrientation } from "@/lib/business-card-layout-generator";
import { readQrImageFile } from "@/lib/member-qr-image";
import type { AiBusinessCardMockup, BusinessCardTemplateLayout, BusinessCardTemplateSideId, BusinessCardTemplateTextFieldId, BusinessCardUserElementId } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type DownloadState = {
  status?: "mockups" | "design" | "pdf";
  error?: string;
};

type AiBusinessCardJobResponse =
  | { jobId: string; kind: "mockups" | "pdf"; status: "queued" | "running" }
  | { jobId: string; kind: "mockups"; status: "succeeded"; mockups: AiBusinessCardMockup[] }
  | { jobId: string; kind: "pdf"; status: "succeeded"; fileName: string; contentType: "application/pdf"; base64: string }
  | { jobId: string; kind: "mockups" | "pdf"; status: "failed" | "cancelled"; reason: string };

const clientRequestTimeoutMs = 540_000;
const businessCardSideOptions = [
  { id: "front", label: "앞면" },
  { id: "back", label: "뒷면" },
];

function cloneBusinessCardTemplateLayout(layout: BusinessCardTemplateLayout): BusinessCardTemplateLayout {
  return {
    canvas: {
      trim: { ...layout.canvas.trim },
      edit: { ...layout.canvas.edit },
      safe: { ...layout.canvas.safe },
    },
    sides: {
      front: {
        logo: { visible: layout.sides.front.logo.visible, box: { ...layout.sides.front.logo.box }, assetType: layout.sides.front.logo.assetType },
        fields: layout.sides.front.fields.map((field) => ({ ...field, box: { ...field.box } })),
        icons: layout.sides.front.icons.map((icon) => ({ ...icon, box: { ...icon.box } })),
        lines: layout.sides.front.lines.map((line) => ({ ...line, box: { ...line.box } })),
        background: { ...layout.sides.front.background },
      },
      back: {
        logo: { visible: layout.sides.back.logo.visible, box: { ...layout.sides.back.logo.box }, assetType: layout.sides.back.logo.assetType },
        fields: layout.sides.back.fields.map((field) => ({ ...field, box: { ...field.box } })),
        icons: layout.sides.back.icons.map((icon) => ({ ...icon, box: { ...icon.box } })),
        lines: layout.sides.back.lines.map((line) => ({ ...line, box: { ...line.box } })),
        background: { ...layout.sides.back.background },
      },
    },
  };
}

function readApiErrorReason(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "reason" in value && typeof value.reason === "string" ? value.reason : fallback;
}

function mergeAiBusinessCardMockups(current: AiBusinessCardMockup[], incoming: AiBusinessCardMockup[]) {
  const merged = [...current];

  for (const mockup of incoming) {
    if (!merged.some((item) => item.imageUrl === mockup.imageUrl)) {
      merged.push(mockup);
    }
  }

  return merged;
}

function hasCompleteAiBusinessCardMockup(mockup: AiBusinessCardMockup) {
  return Boolean(mockup.imageUrl && mockup.cleanImageUrl);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function visibleBusinessCardElements(layout: BusinessCardTemplateLayout, sideId: "front" | "back"): BusinessCardUserElementId[] {
  const side = layout.sides[sideId];

  return [...(side.logo.visible ? ["logo" as const] : []), ...side.fields.filter((field) => field.visible).map((field) => field.id)];
}

async function saveAiBusinessCardMockupsToServer(signature: string, mockups: AiBusinessCardMockup[]) {
  const response = await fetch("/api/ai-business-cards/mockups/saved", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, mockups }),
  });

  if (!response.ok) {
    throw new Error("완료 목업 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

function readCurrentBrandWorkspaceSnapshot(): BrandWorkspace {
  const state = usePrintyStore.getState();

  return {
    brands: state.brands,
    brandAssets: state.brandAssets,
    savedGeneratedLogoOptions: state.savedGeneratedLogoOptions,
    businessCardDrafts: state.businessCardDrafts,
    printProductDrafts: state.printProductDrafts,
    orders: state.orders,
  };
}

async function saveCurrentBrandWorkspaceSnapshot(ownerUserId: string) {
  const workspaceToSave = readCurrentBrandWorkspaceSnapshot();
  const savedSignature = createBrandWorkspaceSignature(workspaceToSave);
  const response = await fetch("/api/brand-workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspaceToSave),
  });

  if (!response.ok) {
    throw new Error("완료 디자인을 서버에 저장하지 못했어요. 다시 저장해 주세요.");
  }

  const workspace = readBrandWorkspace(await response.json());

  if (!workspace) {
    throw new Error("완료 디자인 저장 응답이 올바르지 않아요. 다시 저장해 주세요.");
  }

  const store = usePrintyStore.getState();
  store.syncBrandWorkspace(workspace, ownerUserId);
  store.acknowledgeBrandWorkspaceSave(savedSignature, ownerUserId);
}

function createSavedMockupSearchParams(signature: string, input: { brandName: string; logoId?: string; memberName: string; memberPhone: string }) {
  const params = new URLSearchParams({ signature });

  if (input.brandName.trim()) {
    params.set("brandName", input.brandName.trim());
  }
  if (input.logoId?.trim()) {
    params.set("logoId", input.logoId.trim());
  }
  if (input.memberName.trim()) {
    params.set("memberName", input.memberName.trim());
  }
  if (input.memberPhone.trim()) {
    params.set("memberPhone", input.memberPhone.trim());
  }

  return params;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), clientRequestTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readAiBusinessCardJob(response: Response) {
  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(readApiErrorReason(data, "AI 명함 작업을 시작하지 못했어요."));
  }

  return data as AiBusinessCardJobResponse;
}

async function pollAiBusinessCardJob(jobId: string, onStatus?: (message: string) => void) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(`/api/ai-business-cards/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const job = await readAiBusinessCardJob(response);

    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      return job;
    }

    onStatus?.(createAiRequestStatusMessage("명함 AI 디자인 요청은", (attempt + 1) * aiRequestStatusIntervalMs, job.status === "queued" ? "queued" : "running"));
    await new Promise((resolve) => window.setTimeout(resolve, aiRequestStatusIntervalMs));
  }

  throw new Error("AI 명함 작업이 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.");
}

export function BusinessCardPreviewScreen() {
  const { brandDraft, memberDraft, selectedLogoId, selectedBusinessCardMemberIds, aiBusinessCardMockups, aiBusinessCardMockupStatus, aiBusinessCardMockupMessage, aiBusinessCardMockupSignature, activeAiBusinessCardMockupJobId, selectedAiBusinessCardMockupUrl, beginAiBusinessCardMockupGeneration, setActiveAiBusinessCardMockupJob, syncAiBusinessCardMockups, finishAiBusinessCardMockupGeneration, completeAiBusinessCardDesign, failAiBusinessCardMockupGeneration, selectAiBusinessCardMockup, dismissAiBusinessCardPdfNotice, updateMemberDraft, updateBusinessCardProductionOptions, ensureBusinessCardDraft, syncBrandWorkspace, enterDashboard, openBrandDetail, setBrandSection } = usePrintyStore();
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const authUserId = usePrintyStore((state) => state.authSession?.userId);
  const effectiveLogoId = usePrintyStore((state) => state.brands.find((brand) => brand.id === state.selectedBrandId)?.selectedLogoId ?? selectedLogoId);
  const selectedTemplateId = usePrintyStore((state) => state.selectedTemplateId);
  const selectedTemplate = usePrintyStore((state) => state.templates.find((template) => template.id === state.selectedTemplateId));
  const selectedBrand = usePrintyStore((state) => state.brands.find((brand) => brand.id === state.selectedBrandId));
  const productionOptions = usePrintyStore((state) => state.businessCardProductionOptions);
  const businessCardEditorMode = usePrintyStore((state) => state.businessCardEditorMode);
  const pendingBusinessCardLayoutPrompt = usePrintyStore((state) => state.pendingBusinessCardLayoutPrompt);
  const logo = usePrintyStore((state) => findGeneratedLogoFromState(state, effectiveLogoId));
  const [downloadState, setDownloadState] = useState<DownloadState>({});
  const [mockupRequest, setMockupRequest] = useState("");
  const [cleanBackgroundEditRequest, setCleanBackgroundEditRequest] = useState("");
  const [cleanBackgroundEditStatus, setCleanBackgroundEditStatus] = useState("");
  const [layoutSuggestionMessage, setLayoutSuggestionMessage] = useState("");
  const [isEditingCleanBackground, setIsEditingCleanBackground] = useState(false);
  const [isSuggestingLayout, setIsSuggestingLayout] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [editableLayout, setEditableLayout] = useState<BusinessCardTemplateLayout>();
  const [activeBusinessCardSide, setActiveBusinessCardSide] = useState<BusinessCardTemplateSideId>("front");
  const [savedLayoutMessage, setSavedLayoutMessage] = useState("");
  const loadedServerMockupKeysRef = useRef<Set<string>>(new Set());
  const requestedLogoVectorRefreshIdsRef = useRef<Set<string>>(new Set());
  const appliedInitialLayoutPromptRef = useRef("");
  const productionOptionsWithLayout = useMemo(() => editableLayout ? { ...productionOptions, layout: editableLayout } : productionOptions, [editableLayout, productionOptions]);
  const selectedMemberId = selectedBusinessCardMemberIds[0] ?? memberDraft.id;
  const activeMember = selectedBrand?.members.find((member) => member.id === selectedMemberId) ?? selectedBrand?.members.find((member) => member.id === memberDraft.id) ?? memberDraft;
  const layoutMember = activeMember.id === memberDraft.id ? { ...activeMember, qrCodeImageUrl: memberDraft.qrCodeImageUrl ?? activeMember.qrCodeImageUrl } : activeMember;
  const isDesignEditMode = businessCardEditorMode === "edit";
  const input = { brandName: brandDraft.name, category: brandDraft.category, member: layoutMember, logo, mood: brandDraft.designRequest, mockupRequest, templateId: selectedTemplateId, productionOptions: productionOptionsWithLayout };
  const currentSignature = createAiBusinessCardMockupSignature(input);
  const serverMockupKeys = useMemo(() => [currentSignature], [currentSignature]);
  const serverMockupLoadKey = currentSignature;
  const hasGeneratedMockups = aiBusinessCardMockups.length > 0;
  const hasCurrentMockups = aiBusinessCardMockups.length > 0 && (isDesignEditMode || aiBusinessCardMockupSignature === currentSignature);
  const isGeneratingCurrentMockups = aiBusinessCardMockupSignature === currentSignature && aiBusinessCardMockupStatus === "generating";
  const isAiDesignRequestPending = aiBusinessCardMockupSignature === currentSignature && aiBusinessCardMockupStatus === "generating" && Boolean(activeAiBusinessCardMockupJobId || aiBusinessCardMockupSignature);
  const canGenerateMockups = Boolean(logo?.imageUrl);
  const selectedAiBusinessCardMockup = useMemo(() => aiBusinessCardMockups.find((mockup) => mockup.imageUrl === selectedAiBusinessCardMockupUrl), [aiBusinessCardMockups, selectedAiBusinessCardMockupUrl]);
  const selectedCleanMockupUrl = selectedAiBusinessCardMockup?.cleanImageUrl;
  const selectedBusinessCardSize = useMemo(() => resolveBusinessCardSize(productionOptions.sizeId, editableLayout ?? productionOptions.layout), [editableLayout, productionOptions.layout, productionOptions.sizeId]);
  const cleanBackgroundEditTone: ToastNoticeTone = cleanBackgroundEditStatus.includes("못") || cleanBackgroundEditStatus.includes("필요") || cleanBackgroundEditStatus.includes("실패") ? "danger" : cleanBackgroundEditStatus.includes("추가") || cleanBackgroundEditStatus.includes("선택") ? "success" : "info";
  const layoutSuggestionTone: ToastNoticeTone = layoutSuggestionMessage.includes("못") || layoutSuggestionMessage.includes("실패") || layoutSuggestionMessage.includes("필요") ? "danger" : "success";
  const savedLayoutTone: ToastNoticeTone = savedLayoutMessage.includes("못") || savedLayoutMessage.includes("실패") || savedLayoutMessage.includes("찾지") ? "danger" : "success";

  useEffect(() => {
    setEditableLayout(productionOptions.layout ? cloneBusinessCardTemplateLayout(productionOptions.layout) : selectedTemplate?.layout ? cloneBusinessCardTemplateLayout(selectedTemplate.layout) : createSizedBusinessCardLayout(productionOptions));
  }, [selectedTemplate?.id, selectedTemplate?.layout, productionOptions]);

  useEffect(() => {
    if (!isAuthenticated || !authUserId || !logo?.imageUrl || logo.vectorSvgUrl || requestedLogoVectorRefreshIdsRef.current.has(effectiveLogoId)) {
      return;
    }

    let isActive = true;
    requestedLogoVectorRefreshIdsRef.current.add(effectiveLogoId);

    async function refreshWorkspaceForVectorLogo() {
      const response = await fetch("/api/brand-workspace", { cache: "no-store" });

      if (!response.ok || !isActive) {
        return;
      }

      const workspace = readBrandWorkspace(await response.json());

      if (workspace && isActive) {
        syncBrandWorkspace(workspace, authUserId);
      }
    }

    void refreshWorkspaceForVectorLogo().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [authUserId, effectiveLogoId, isAuthenticated, logo?.imageUrl, logo?.vectorSvgUrl, syncBrandWorkspace]);

  const requestBody = () => createAiBusinessCardRequestBody(input);
  const withCurrentLayoutMockups = (mockups: AiBusinessCardMockup[]) => mockups.map((mockup) => (editableLayout ? { ...mockup, layout: cloneBusinessCardTemplateLayout(editableLayout) } : mockup));
  const applyGeneratedMockups = (signature: string, generatedMockups: AiBusinessCardMockup[], mergeWithCurrent: boolean) => {
    const generatedLayoutMockups = withCurrentLayoutMockups(generatedMockups.filter(hasCompleteAiBusinessCardMockup));

    if (generatedLayoutMockups.length === 0) {
      return false;
    }

    const serverMockups = mergeWithCurrent && aiBusinessCardMockupSignature === signature ? mergeAiBusinessCardMockups(aiBusinessCardMockups, generatedLayoutMockups) : generatedLayoutMockups;

    finishAiBusinessCardMockupGeneration(signature, generatedLayoutMockups);
    void saveServerMockups(serverMockups).catch(() => undefined);
    return true;
  };
  const updateEditableLayout = (layout: BusinessCardTemplateLayout) => {
    setEditableLayout(layout);
  };
  const syncProductionOptionsLayout = (layout: BusinessCardTemplateLayout) => {
    updateBusinessCardProductionOptions({ ...productionOptions, frontElements: visibleBusinessCardElements(layout, "front"), backElements: visibleBusinessCardElements(layout, "back"), ...businessCardProductionSizeFields(undefined, layout), layout });
  };
  const updateLayoutOrientation = (orientation: "horizontal" | "vertical") => {
    setEditableLayout((current) => {
      if (!current) {
        return current;
      }

      const nextLayout = layoutForBusinessCardOrientation(current, orientation);
      syncProductionOptionsLayout(nextLayout);
      return nextLayout;
    });
  };
  const updateLayoutAndProductionOptions = (layout: BusinessCardTemplateLayout) => {
    updateEditableLayout(layout);
    syncProductionOptionsLayout(layout);
  };
  const updateBusinessCardSize = (sizeId: string) => {
    setEditableLayout((current) => {
      const baseLayout = current ?? productionOptions.layout ?? selectedTemplate?.layout ?? createSizedBusinessCardLayout(productionOptions);
      const nextLayout = sizeBusinessCardLayout(baseLayout, sizeId);

      updateBusinessCardProductionOptions({ ...productionOptions, frontElements: visibleBusinessCardElements(nextLayout, "front"), backElements: visibleBusinessCardElements(nextLayout, "back"), ...businessCardProductionSizeFields(sizeId, nextLayout), layout: nextLayout });
      return nextLayout;
    });
  };
  const updateUserFieldValue = (fieldId: BusinessCardTemplateTextFieldId, value: string) => {
    if (!editableLayout) return;
    updateLayoutAndProductionOptions({ ...editableLayout, sides: { front: { ...editableLayout.sides.front, fields: editableLayout.sides.front.fields.map((field) => field.id === fieldId ? { ...field, customValue: value } : field) }, back: { ...editableLayout.sides.back, fields: editableLayout.sides.back.fields.map((field) => field.id === fieldId ? { ...field, customValue: value } : field) } } });
  };
  const updateUserQrCodeImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      updateMemberDraft("qrCodeImageUrl", await readQrImageFile(file));
    } catch (error) {
      setDownloadState({ error: error instanceof Error ? error.message : "QR 이미지를 읽지 못했어요." });
    }
  };

  const saveServerMockups = async (mockups: AiBusinessCardMockup[]) => {
    if (!isAuthenticated) {
      return;
    }

    await Promise.all(serverMockupKeys.map((key) => saveAiBusinessCardMockupsToServer(key, mockups)));
  };

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      return;
    }

    const loadKey = `${authUserId}:${serverMockupLoadKey}`;

    if (loadedServerMockupKeysRef.current.has(loadKey)) {
      return;
    }

    loadedServerMockupKeysRef.current.add(loadKey);

    let isActive = true;

    async function loadServerMockups() {
      if (isDesignEditMode && aiBusinessCardMockups.length > 0) {
        await Promise.all(serverMockupKeys.map((key) => saveAiBusinessCardMockupsToServer(key, aiBusinessCardMockups)));
        return;
      }

      for (const key of serverMockupKeys) {
        const params = createSavedMockupSearchParams(key, { brandName: brandDraft.name, logoId: effectiveLogoId, memberName: layoutMember.name, memberPhone: layoutMember.phone });
        const response = await fetch(`/api/ai-business-cards/mockups/saved?${params.toString()}`, { cache: "no-store" });

        if (!response.ok || !isActive) {
          continue;
        }

        const data = await response.json() as { mockups?: AiBusinessCardMockup[] };
        const serverMockups = Array.isArray(data.mockups) ? data.mockups.filter(hasCompleteAiBusinessCardMockup) : [];

        if (serverMockups.length > 0) {
          syncAiBusinessCardMockups(currentSignature, serverMockups);

          if (key !== currentSignature || serverMockupKeys.some((mockupKey) => mockupKey !== key)) {
            await Promise.all(serverMockupKeys.filter((mockupKey) => mockupKey !== key).map((mockupKey) => saveAiBusinessCardMockupsToServer(mockupKey, serverMockups)));
          }

          return;
        }
      }

      if (aiBusinessCardMockupSignature === currentSignature && aiBusinessCardMockups.length > 0) {
        await Promise.all(serverMockupKeys.map((key) => saveAiBusinessCardMockupsToServer(key, aiBusinessCardMockups)));
      }
    }

    void loadServerMockups().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, authUserId, currentSignature, serverMockupKeys, serverMockupLoadKey, aiBusinessCardMockupSignature, aiBusinessCardMockups, isDesignEditMode, syncAiBusinessCardMockups]);

  useEffect(() => {
    if (hasCurrentMockups || aiBusinessCardMockupSignature !== currentSignature) {
      return;
    }

    let isActive = true;

    async function recoverMockupJob() {
      const response = await fetch(activeAiBusinessCardMockupJobId ? `/api/ai-business-cards/jobs/${encodeURIComponent(activeAiBusinessCardMockupJobId)}` : `/api/ai-business-cards/jobs/active?kind=mockups&signature=${encodeURIComponent(currentSignature)}`, { cache: "no-store" });

      if (response.status === 404 || !isActive) {
        return;
      }

      const queuedJob = await readAiBusinessCardJob(response);

      if (queuedJob.status === "queued" || queuedJob.status === "running") {
        setActiveAiBusinessCardMockupJob(queuedJob.jobId);
      }

      const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId, (message) => beginAiBusinessCardMockupGeneration(currentSignature, message));

      if (!isActive) {
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        failAiBusinessCardMockupGeneration(currentSignature, job.reason);
        return;
      }

      if (job.kind === "mockups" && job.status === "succeeded") {
        applyGeneratedMockups(currentSignature, job.mockups, false);
      }
    }

    void recoverMockupJob().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [hasCurrentMockups, aiBusinessCardMockupSignature, aiBusinessCardMockupStatus, activeAiBusinessCardMockupJobId, currentSignature, failAiBusinessCardMockupGeneration, finishAiBusinessCardMockupGeneration, setActiveAiBusinessCardMockupJob]);

  const recoverCurrentMockupState = async () => {
    if (isAuthenticated) {
      const params = createSavedMockupSearchParams(currentSignature, { brandName: brandDraft.name, logoId: effectiveLogoId, memberName: layoutMember.name, memberPhone: layoutMember.phone });
      const savedResponse = await fetch(`/api/ai-business-cards/mockups/saved?${params.toString()}`, { cache: "no-store" }).catch(() => undefined);

      if (savedResponse?.ok) {
        const data = await savedResponse.json() as { mockups?: AiBusinessCardMockup[] };
        const serverMockups = Array.isArray(data.mockups) ? data.mockups.filter(hasCompleteAiBusinessCardMockup) : [];

        if (serverMockups.length > 0) {
          syncAiBusinessCardMockups(currentSignature, withCurrentLayoutMockups(serverMockups));
          return true;
        }
      }
    }

    const jobResponse = await fetch(`/api/ai-business-cards/jobs/active?kind=mockups&signature=${encodeURIComponent(currentSignature)}`, { cache: "no-store" }).catch(() => undefined);

    if (!jobResponse || jobResponse.status === 404) {
      return false;
    }

    const queuedJob = await readAiBusinessCardJob(jobResponse);

    if (queuedJob.status === "queued" || queuedJob.status === "running") {
      setActiveAiBusinessCardMockupJob(queuedJob.jobId);
      const job = await pollAiBusinessCardJob(queuedJob.jobId, (message) => beginAiBusinessCardMockupGeneration(currentSignature, message));

      if (job.status === "failed" || job.status === "cancelled") {
        failAiBusinessCardMockupGeneration(currentSignature, job.reason);
        setDownloadState({ error: job.reason });
        return true;
      }

      return job.kind === "mockups" && job.status === "succeeded" ? applyGeneratedMockups(currentSignature, job.mockups, true) : false;
    }

    if (queuedJob.status === "failed" || queuedJob.status === "cancelled") {
      failAiBusinessCardMockupGeneration(currentSignature, queuedJob.reason);
      setDownloadState({ error: queuedJob.reason });
      return true;
    }

    return queuedJob.kind === "mockups" && queuedJob.status === "succeeded" ? applyGeneratedMockups(currentSignature, queuedJob.mockups, true) : false;
  };

  const startBackgroundMockups = () => {
    if (!canGenerateMockups) {
      const message = "대표 로고 이미지가 필요해요. 브랜드의 대표 로고를 먼저 생성하거나 등록해 주세요.";

      failAiBusinessCardMockupGeneration(currentSignature, message);
      setDownloadState({ error: message });
      return;
    }

    const signature = currentSignature;

    if (editableLayout) {
      syncProductionOptionsLayout(editableLayout);
    }

    beginAiBusinessCardMockupGeneration(signature);
    setActiveAiBusinessCardMockupJob(undefined);
    dismissAiBusinessCardPdfNotice();
    setCleanBackgroundEditStatus("");
    setDownloadState({});
    const stopStatusTicker = startAiRequestStatusTicker({ label: "명함 AI 디자인 요청은", phase: "queued", onStatus: (message) => beginAiBusinessCardMockupGeneration(signature, message) });

    void fetchWithTimeout("/api/ai-business-cards/mockups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...requestBody(), count: 1, signature }),
    })
      .then(async (response) => {
        const queuedJob = await readAiBusinessCardJob(response);

        if (queuedJob.status === "queued" || queuedJob.status === "running") {
          setActiveAiBusinessCardMockupJob(queuedJob.jobId);
        }

        const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId, (message) => beginAiBusinessCardMockupGeneration(signature, message));

        if (job.status === "failed" || job.status === "cancelled") {
          throw new Error(job.reason);
        }

        if (job.kind !== "mockups" || job.status !== "succeeded") {
          throw new Error("AI 명함 시안을 만들 수 없어요. 잠시 후 다시 시도해 주세요.");
        }

        const generatedMockups = job.mockups.filter(hasCompleteAiBusinessCardMockup);

        if (generatedMockups.length === 0) {
          throw new Error("일반 목업과 클린 배경 목업이 모두 생성되지 않았어요. 다시 시도해 주세요.");
        }

        applyGeneratedMockups(signature, generatedMockups, true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          beginAiBusinessCardMockupGeneration(signature, "명함 목업 디자인을 백그라운드에서 계속 확인하고 있어요. 완료되면 이 화면에 자동으로 표시돼요.");
          setDownloadState({});
          return;
        }

        const message = error instanceof Error ? error.message : "AI 명함 시안을 만들 수 없어요. 잠시 후 다시 시도해 주세요.";

        failAiBusinessCardMockupGeneration(signature, message);
        setDownloadState({ error: message });
      })
      .finally(() => {
        stopStatusTicker();
      });
  };

  const handleGenerateMockups = async () => {
    const recovered = await recoverCurrentMockupState().catch(() => false);

    if (recovered) {
      return;
    }

    startBackgroundMockups();
  };

  const applyLayoutPrompt = async (prompt: string) => {
    if (!editableLayout) {
      setLayoutSuggestionMessage("명함 레이아웃을 먼저 준비해 주세요.");
      return;
    }

    const layoutPrompt = prompt.trim();

    if (!layoutPrompt) {
      setLayoutSuggestionMessage("레이아웃 프롬프트를 입력해 주세요.");
      return;
    }

    setIsSuggestingLayout(true);
    setLayoutSuggestionMessage("프롬프트로 명함 좌표를 잡고 있어요.");
    setDownloadState({});

    try {
      const response = await fetch("/api/ai-business-cards/layout-suggestion", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: layoutPrompt, brandName: brandDraft.name, category: brandDraft.category, baseLayout: editableLayout }),
      });
      const payload = await response.json() as { layout?: BusinessCardTemplateLayout; reason?: string; source?: string };

      if (!response.ok || !payload.layout) {
        throw new Error(payload.reason || "명함 레이아웃 제안을 만들지 못했어요.");
      }

      updateLayoutAndProductionOptions(cloneBusinessCardTemplateLayout(payload.layout));
      setLayoutSuggestionMessage(payload.source === "fallback" ? "기본 규칙으로 명함 좌표를 먼저 잡았어요. 바로 수정하거나 AI 디자인 요청을 이어서 할 수 있어요." : "프롬프트를 반영해 명함 좌표를 먼저 잡았어요.");
    } catch (error) {
      setLayoutSuggestionMessage(error instanceof Error ? error.message : "명함 레이아웃 제안을 만들지 못했어요.");
    } finally {
      setIsSuggestingLayout(false);
    }
  };

  useEffect(() => {
    if (isDesignEditMode || !editableLayout) {
      return;
    }

    const prompt = pendingBusinessCardLayoutPrompt.trim();

    if (!prompt || appliedInitialLayoutPromptRef.current === prompt) {
      return;
    }

    appliedInitialLayoutPromptRef.current = prompt;
    usePrintyStore.setState({ pendingBusinessCardLayoutPrompt: "" });
    void applyLayoutPrompt(prompt);
  }, [editableLayout, isDesignEditMode, pendingBusinessCardLayoutPrompt]);

  const handleSaveLayoutDraft = async () => {
    if (!editableLayout) {
      return;
    }

    syncProductionOptionsLayout(editableLayout);
    const draft = ensureBusinessCardDraft(cloneBusinessCardTemplateLayout(editableLayout));

    setSavedLayoutMessage(`${draft.member.name || "이름 미입력"} 명함 레이아웃을 임시 저장했어요.`);
    setDownloadState({});
  };

  const handleSaveDesign = async () => {
    if (!editableLayout) {
      return;
    }

    if (aiBusinessCardMockups.length === 0) {
      setSavedLayoutMessage("저장할 완료 목업 데이터를 찾지 못했어요. 대시보드에서 완료 목업을 다시 열어 주세요.");
      return;
    }

    const selectedMockup = selectedAiBusinessCardMockup ?? aiBusinessCardMockups[0];

    if (!selectedMockup) {
      setSavedLayoutMessage("저장할 선택 시안을 찾지 못했어요. 시안을 선택한 뒤 다시 시도해 주세요.");
      return;
    }

    const layoutMockups = withCurrentLayoutMockups([selectedMockup, ...aiBusinessCardMockups.filter((mockup) => mockup.imageUrl !== selectedMockup.imageUrl)]);

    syncProductionOptionsLayout(editableLayout);

    try {
      setIsSavingDesign(true);
      setSavedLayoutMessage("완료 목업 디자인을 저장하고 있어요.");
      await saveServerMockups(layoutMockups);
      const draft = completeAiBusinessCardDesign(aiBusinessCardMockupSignature ?? currentSignature, layoutMockups, cloneBusinessCardTemplateLayout(editableLayout));

      if (isAuthenticated && authUserId) {
        await saveCurrentBrandWorkspaceSnapshot(authUserId);
      }

      setSavedLayoutMessage(isDesignEditMode ? "완료 목업 디자인을 업데이트했어요." : "선택한 명함 디자인을 저장했어요. 명함 탭으로 이동해요.");
      setDownloadState({});

      if (!isDesignEditMode && draft?.brandId) {
        enterDashboard();
        openBrandDetail(draft.brandId);
        setBrandSection("cards");
      }
    } catch (error) {
      setSavedLayoutMessage(error instanceof Error ? error.message : "완료 목업 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleEditCleanBackground = async () => {
    if (!selectedCleanMockupUrl) {
      setCleanBackgroundEditStatus("수정할 클린 배경 목업을 먼저 선택해 주세요.");
      return;
    }

    const editRequest = cleanBackgroundEditRequest.trim();

    if (!editRequest) {
      setCleanBackgroundEditStatus("배경 이미지 수정 요청을 입력해 주세요.");
      return;
    }

    setCleanBackgroundEditStatus("배경 이미지 수정 요청을 보내고 있어요. 완료되면 새 후보로 자동 선택돼요.");
    setIsEditingCleanBackground(true);
    setDownloadState({});

    try {
      const response = await fetch("/api/ai-business-cards/backgrounds/edit", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanImageUrl: selectedCleanMockupUrl, editRequest }),
      });
      const queuedJob = await readAiBusinessCardJob(response);

      if (queuedJob.status === "queued" || queuedJob.status === "running") {
        setCleanBackgroundEditStatus("배경 이미지 수정을 백그라운드에서 진행하고 있어요. 완료되면 자동으로 새 후보를 선택해요.");
      }

      const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId, (message) => setCleanBackgroundEditStatus(message.replace("명함 AI 디자인 요청은", "배경 이미지 수정 요청은")));

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.reason);
      }

      const mockup = job.kind === "mockups" && job.status === "succeeded" ? job.mockups[0] : undefined;

      if (!mockup) {
        throw new Error("배경 이미지 응답이 올바르지 않아요.");
      }

      const layoutMockup = withCurrentLayoutMockups([mockup])[0];
      const nextMockups = mergeAiBusinessCardMockups(aiBusinessCardMockups, [layoutMockup]);

      syncAiBusinessCardMockups(currentSignature, nextMockups);
      if (isDesignEditMode) {
        void saveServerMockups(nextMockups);
      }
      selectAiBusinessCardMockup(layoutMockup.imageUrl);
      setCleanBackgroundEditStatus("배경 이미지를 새 후보로 추가하고 선택했어요.");
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "배경 이미지 수정이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요." : error instanceof Error ? error.message : "배경 이미지를 수정하지 못했어요.";

      setCleanBackgroundEditStatus(message);
    } finally {
      setIsEditingCleanBackground(false);
    }
  };

  return (
    <Screen>
      {cleanBackgroundEditStatus || layoutSuggestionMessage || downloadState.error || savedLayoutMessage ? (
        <ToastNoticeViewport>
          {cleanBackgroundEditStatus ? <ToastNotice eyebrow="디자인 수정" message={cleanBackgroundEditStatus} tone={cleanBackgroundEditTone} loading={isEditingCleanBackground} onDismiss={() => setCleanBackgroundEditStatus("")} /> : null}
          {layoutSuggestionMessage ? <ToastNotice eyebrow="레이아웃 제안" message={layoutSuggestionMessage} tone={layoutSuggestionTone} loading={isSuggestingLayout} onDismiss={() => setLayoutSuggestionMessage("")} /> : null}
          {savedLayoutMessage ? <ToastNotice eyebrow="명함 저장" message={savedLayoutMessage} tone={savedLayoutTone} onDismiss={() => setSavedLayoutMessage("")} /> : null}
          {downloadState.error ? <ToastNotice eyebrow="작업 실패" message={downloadState.error} tone="danger" onDismiss={() => setDownloadState({})} /> : null}
        </ToastNoticeViewport>
      ) : null}
      <ProgressHeader eyebrow="AI 명함 생성" title="앞면과 뒷면을 AI로 구성해요" description="먼저 대표 로고와 입력 정보를 기준으로 정면 양면 목업을 만들어요." step={stepNumbers.businessCardPreview} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <ProductionSizeCard title="명함 사이즈" description="이 제작 화면에서 인쇄 사이즈를 정해요. 사이즈를 바꾸면 현재 레이아웃 비율과 PDF 크기도 함께 바뀝니다." value={selectedBusinessCardSize.id} options={businessCardSizeOptions} onChange={updateBusinessCardSize} sideValue={activeBusinessCardSide} sideOptions={businessCardSideOptions} onSideChange={(value) => setActiveBusinessCardSide(value as BusinessCardTemplateSideId)} />
      {editableLayout ? (
        <div className="-mx-5">
          <BusinessCardLayoutBuilder layout={editableLayout} orientation={getBusinessCardLayoutOrientation(editableLayout)} managedBackgrounds={[]} mode="user" userFieldValues={{ name: layoutMember.name, role: layoutMember.role, phone: layoutMember.phone, mainPhone: layoutMember.mainPhone, fax: layoutMember.fax, email: layoutMember.email, website: layoutMember.website ?? "", address: layoutMember.address, account: layoutMember.account ?? "", instagram: layoutMember.instagram ?? "" }} userQrCodeImageUrl={layoutMember.qrCodeImageUrl ?? ""} logoImageUrl={logo?.imageUrl} logoVectorSvgUrl={logo?.vectorSvgUrl} cleanPreviewImageUrl={selectedCleanMockupUrl} activeSideId={activeBusinessCardSide} onActiveSideChange={setActiveBusinessCardSide} onOrientationChange={updateLayoutOrientation} onUserFieldValueChange={updateUserFieldValue} onUserQrCodeImageChange={updateUserQrCodeImage} onUserQrCodeImageClear={() => updateMemberDraft("qrCodeImageUrl", "")} onChange={updateLayoutAndProductionOptions} />
        </div>
      ) : null}
      <ProductionAiDesignRequestCard
        mode={isDesignEditMode ? "edit" : "create"}
        title={isDesignEditMode ? "명함 디자인 수정" : "AI 디자인 요청"}
        description={isDesignEditMode ? "선택한 클린 배경 위에서 로고, 텍스트, 아이콘, QR 좌표를 수정하고 저장해요." : "요청을 정리한 뒤 명함 시안을 만들고, 선택한 시안을 디자인 저장하기로 완료 목록에 저장해요."}
        promptPlaceholder="예: 검정 배경에 금색 포인트, 여백 넓게, 고급스러운 분위기. 입력한 명함 문구 외 문장은 추가하지 않기."
        promptValue={isDesignEditMode ? cleanBackgroundEditRequest : mockupRequest}
        onPromptChange={isDesignEditMode ? setCleanBackgroundEditRequest : setMockupRequest}
        onTemporarySave={hasGeneratedMockups ? undefined : handleSaveLayoutDraft}
        temporarySaveLabel="저장하기"
        temporarySaveDisabled={!editableLayout}
        onAiRequest={isDesignEditMode ? handleEditCleanBackground : handleGenerateMockups}
        isAiRequestLoading={isDesignEditMode ? isEditingCleanBackground : downloadState.status === "mockups" || isGeneratingCurrentMockups || isAiDesignRequestPending}
        aiRequestDisabled={isDesignEditMode ? !selectedCleanMockupUrl || !cleanBackgroundEditRequest.trim() || isEditingCleanBackground : !canGenerateMockups || downloadState.status === "mockups" || isGeneratingCurrentMockups || isAiDesignRequestPending}
        showSaveDesign={hasGeneratedMockups}
        onSaveDesign={handleSaveDesign}
        saveDesignLabel="저장하기"
        saveDesignDisabled={!editableLayout || aiBusinessCardMockups.length === 0 || isSavingDesign}
        notices={<>
          {!canGenerateMockups ? <p className="mt-3 rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">대표 로고 이미지가 필요해요. 브랜드의 대표 로고를 먼저 생성하거나 등록해 주세요.</p> : null}
          {aiBusinessCardMockupMessage ? <p className="mt-3 rounded-md bg-surface-blue px-4 py-3 text-xs font-bold leading-5 text-muted">{aiBusinessCardMockupMessage}</p> : null}
          {!isDesignEditMode && isAiDesignRequestPending ? <p className="mt-3 rounded-md bg-surface-blue px-4 py-3 text-xs font-bold leading-5 text-primary-strong">AI 디자인 요청이 진행 중이에요. 완료되면 토스트로 알려드릴게요.</p> : null}
        </>}
      >
        {isDesignEditMode && !selectedCleanMockupUrl ? <p className="rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">수정할 클린 배경 시안이 필요해요. 완료 시안을 다시 선택해 주세요.</p> : null}
      </ProductionAiDesignRequestCard>
      {aiBusinessCardMockups.length > 0 ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">지금까지 생성한 이미지</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">이 명함 제작 화면에서 만든 시안을 모두 보여줘요. 수정 결과는 자동 선택되고, 이전 이미지는 목록에 남아요.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {aiBusinessCardMockups.map((mockup) => {
              const mockupLayout = mockup.layout ?? editableLayout;
              const isSelected = mockup.imageUrl === selectedAiBusinessCardMockupUrl;

              return (
                <div key={mockup.imageUrl} className={`rounded-lg border p-2 ${isSelected ? "border-primary bg-surface-blue" : "border-line bg-surface"}`}>
                  <button className="block w-full text-left" type="button" onClick={() => selectAiBusinessCardMockup(mockup.imageUrl)}>
                    {mockup.cleanImageUrl && mockupLayout ? (
                      <div className="grid gap-2">
                        <BusinessCardUserPreview className="rounded-md shadow-card" cleanImageUrl={mockup.cleanImageUrl} layout={mockupLayout} member={layoutMember} logo={logo} sideId="front" />
                        <BusinessCardUserPreview className="rounded-md shadow-card" cleanImageUrl={mockup.cleanImageUrl} layout={mockupLayout} member={layoutMember} logo={logo} sideId="back" />
                      </div>
                    ) : (
                      <div className="grid aspect-[3/2] place-items-center rounded-md bg-surface-blue text-xs font-bold text-muted">미리보기 준비 중</div>
                    )}
                    <p className="mt-2 text-xs font-black text-ink">{mockup.title}</p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button className={`rounded-sm px-3 py-2 text-xs font-black shadow-soft transition ${isSelected ? "bg-primary text-white" : "bg-white text-primary-strong hover:-translate-y-0.5"}`} type="button" onClick={() => selectAiBusinessCardMockup(mockup.imageUrl)} disabled={isSelected}>{isSelected ? "적용됨" : "선택하기"}</button>
                    <span className="text-[11px] font-bold text-muted">{isSelected ? "현재 편집 배경" : "생성 시안"}</span>
                    <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.imageUrl} target="_blank" rel="noreferrer">원본 보기</a>
                    {mockup.cleanImageUrl ? <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.cleanImageUrl} target="_blank" rel="noreferrer">클린 보기</a> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SoftCard>
      ) : null}
    </Screen>
  );
}
