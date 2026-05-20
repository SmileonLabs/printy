"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessCardLayoutBuilder } from "@/components/admin/business-card-layout-builder";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard, TextAreaField } from "@/components/ui";
import { createAiBusinessCardMockupSignature, createAiBusinessCardRequestBody } from "@/lib/ai-business-card/client";
import { createBusinessCardLayoutFromSelection, getBusinessCardLayoutOrientation, layoutForBusinessCardOrientation } from "@/lib/business-card-layout-generator";
import { readQrImageFile } from "@/lib/member-qr-image";
import type { AiBusinessCardDesign } from "@/lib/ai-business-card/schema";
import type { AiBusinessCardMockup, BusinessCardTemplateLayout, BusinessCardTemplateTextFieldId, BusinessCardUserElementId } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type DownloadState = {
  status?: "mockups" | "design" | "pdf";
  error?: string;
};

type PdfStage = "render";
type AiBusinessCardJobResponse =
  | { jobId: string; kind: "mockups" | "pdf"; status: "queued" | "running" }
  | { jobId: string; kind: "mockups"; status: "succeeded"; mockups: AiBusinessCardMockup[] }
  | { jobId: string; kind: "pdf"; status: "succeeded"; fileName: string; contentType: "application/pdf"; base64: string }
  | { jobId: string; kind: "mockups" | "pdf"; status: "failed" | "cancelled"; reason: string };

const clientRequestTimeoutMs = 540_000;
const aiBusinessCardPdfRendererVersion = "pdf-template-bg-v20-fast-mockup";

function cloneBusinessCardTemplateLayout(layout: BusinessCardTemplateLayout): BusinessCardTemplateLayout {
  return {
    canvas: {
      trim: { ...layout.canvas.trim },
      edit: { ...layout.canvas.edit },
      safe: { ...layout.canvas.safe },
    },
    sides: {
      front: {
        logo: { visible: layout.sides.front.logo.visible, box: { ...layout.sides.front.logo.box } },
        fields: layout.sides.front.fields.map((field) => ({ ...field, box: { ...field.box } })),
        icons: layout.sides.front.icons.map((icon) => ({ ...icon, box: { ...icon.box } })),
        lines: layout.sides.front.lines.map((line) => ({ ...line, box: { ...line.box } })),
        background: { ...layout.sides.front.background },
      },
      back: {
        logo: { visible: layout.sides.back.logo.visible, box: { ...layout.sides.back.logo.box } },
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

function readDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return asciiMatch?.[1] ?? fallback;
}

function createPdfBlobUrl(blob: Blob) {
  const url = URL.createObjectURL(blob);

  window.setTimeout(() => URL.revokeObjectURL(url), 30 * 60_000);
  return url;
}

function createPdfBlobFromBase64(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: "application/pdf" });
}

function downloadPdfUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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

function visibleBusinessCardElements(layout: BusinessCardTemplateLayout, sideId: "front" | "back"): BusinessCardUserElementId[] {
  return layout.sides[sideId].fields.filter((field) => field.visible).map((field) => field.id);
}

async function saveAiBusinessCardMockupsToServer(signature: string, mockups: AiBusinessCardMockup[]) {
  await fetch("/api/ai-business-cards/mockups/saved", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, mockups }),
  });
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

async function pollAiBusinessCardJob(jobId: string) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(`/api/ai-business-cards/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const job = await readAiBusinessCardJob(response);

    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      return job;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3_000));
  }

  throw new Error("AI 명함 작업이 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.");
}

export function BusinessCardPreviewScreen() {
  const { brandDraft, memberDraft, selectedLogoId, aiBusinessCardMockups, aiBusinessCardMockupStatus, aiBusinessCardMockupMessage, aiBusinessCardMockupSignature, activeAiBusinessCardMockupJobId, selectedAiBusinessCardMockupUrl, beginAiBusinessCardMockupGeneration, setActiveAiBusinessCardMockupJob, syncAiBusinessCardMockups, finishAiBusinessCardMockupGeneration, failAiBusinessCardMockupGeneration, selectAiBusinessCardMockup, deleteAiBusinessCardMockup, beginAiBusinessCardPdfGeneration, finishAiBusinessCardPdfGeneration, failAiBusinessCardPdfGeneration, dismissAiBusinessCardPdfNotice, updateMemberDraft, updateBusinessCardProductionOptions } = usePrintyStore();
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const authUserId = usePrintyStore((state) => state.authSession?.userId);
  const effectiveLogoId = usePrintyStore((state) => state.brands.find((brand) => brand.id === state.selectedBrandId)?.selectedLogoId ?? selectedLogoId);
  const selectedTemplateId = usePrintyStore((state) => state.selectedTemplateId);
  const selectedTemplate = usePrintyStore((state) => state.templates.find((template) => template.id === state.selectedTemplateId));
  const productionOptions = usePrintyStore((state) => state.businessCardProductionOptions);
  const logo = usePrintyStore((state) => [...state.generatedLogoOptions, ...state.savedGeneratedLogoOptions].find((item) => item.id === effectiveLogoId));
  const [downloadState, setDownloadState] = useState<DownloadState>({});
  const [pdfProgressMessages, setPdfProgressMessages] = useState<Record<string, string>>({});
  const [pdfStageErrors, setPdfStageErrors] = useState<Record<string, string>>({});
  const [runningPdfStages, setRunningPdfStages] = useState<Record<string, PdfStage>>({});
  const [mockupRequest, setMockupRequest] = useState("");
  const [editableLayout, setEditableLayout] = useState<BusinessCardTemplateLayout>();
  const loadedServerMockupKeysRef = useRef<Set<string>>(new Set());
  const productionOptionsWithLayout = useMemo(() => editableLayout ? { ...productionOptions, layout: editableLayout } : productionOptions, [editableLayout, productionOptions]);
  const input = { brandName: brandDraft.name, category: brandDraft.category, member: memberDraft, logo, mood: brandDraft.designRequest, mockupRequest, templateId: selectedTemplateId, productionOptions: productionOptionsWithLayout };
  const currentSignature = createAiBusinessCardMockupSignature(input);
  const serverMockupKeys = useMemo(() => [currentSignature], [currentSignature]);
  const serverMockupLoadKey = currentSignature;
  const hasCurrentMockups = aiBusinessCardMockupSignature === currentSignature && aiBusinessCardMockups.length > 0;
  const isGeneratingCurrentMockups = aiBusinessCardMockupSignature === currentSignature && aiBusinessCardMockupStatus === "generating";
  const canGenerateMockups = Boolean(logo?.imageUrl);
  const aiBusinessCardPdfStatus = usePrintyStore((state) => state.aiBusinessCardPdfStatus);
  const aiBusinessCardPdfSignature = usePrintyStore((state) => state.aiBusinessCardPdfSignature);
  const aiBusinessCardPdfRecords = usePrintyStore((state) => state.aiBusinessCardPdfRecords);

  useEffect(() => {
    setEditableLayout(productionOptions.layout ? cloneBusinessCardTemplateLayout(productionOptions.layout) : selectedTemplate?.layout ? cloneBusinessCardTemplateLayout(selectedTemplate.layout) : createBusinessCardLayoutFromSelection(productionOptions));
  }, [selectedTemplate?.id, selectedTemplate?.layout, productionOptions]);

  const requestBody = () => createAiBusinessCardRequestBody(input);
  const updateEditableLayout = (layout: BusinessCardTemplateLayout) => {
    setEditableLayout(layout);
  };
  const syncProductionOptionsLayout = (layout: BusinessCardTemplateLayout) => {
    updateBusinessCardProductionOptions({ ...productionOptions, frontElements: visibleBusinessCardElements(layout, "front"), backElements: visibleBusinessCardElements(layout, "back"), layout });
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
  const updateUserFieldValue = (fieldId: BusinessCardTemplateTextFieldId, value: string) => {
    if (fieldId !== "titleLine1" && fieldId !== "titleLine2" && fieldId !== "adLine1" && fieldId !== "adLine2") {
      return;
    }

    updateMemberDraft(fieldId, value);
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

  const saveServerMockups = (mockups: AiBusinessCardMockup[]) => {
    if (!isAuthenticated) {
      return;
    }

    for (const key of serverMockupKeys) {
      void saveAiBusinessCardMockupsToServer(key, mockups);
    }
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
      for (const key of serverMockupKeys) {
        const params = createSavedMockupSearchParams(key, { brandName: brandDraft.name, logoId: effectiveLogoId, memberName: memberDraft.name, memberPhone: memberDraft.phone });
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
  }, [isAuthenticated, authUserId, currentSignature, serverMockupKeys, serverMockupLoadKey, aiBusinessCardMockupSignature, aiBusinessCardMockups, syncAiBusinessCardMockups]);

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

      const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId);

      if (!isActive) {
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        failAiBusinessCardMockupGeneration(currentSignature, job.reason);
        return;
      }

      if (job.kind === "mockups" && job.status === "succeeded") {
        const generatedMockups = job.mockups.filter(hasCompleteAiBusinessCardMockup);

        finishAiBusinessCardMockupGeneration(currentSignature, generatedMockups);
      }
    }

    void recoverMockupJob().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [hasCurrentMockups, aiBusinessCardMockupSignature, aiBusinessCardMockupStatus, activeAiBusinessCardMockupJobId, currentSignature, failAiBusinessCardMockupGeneration, finishAiBusinessCardMockupGeneration, setActiveAiBusinessCardMockupJob]);

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
    setDownloadState({});

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

        const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId);

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

        const serverMockups = aiBusinessCardMockupSignature === signature ? mergeAiBusinessCardMockups(aiBusinessCardMockups, generatedMockups) : generatedMockups;

        finishAiBusinessCardMockupGeneration(signature, generatedMockups);
        saveServerMockups(serverMockups);
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
      });
  };

  const handleGenerateMockups = async () => {
    startBackgroundMockups();
  };

  const createPdfSignature = (mockupImageUrl: string, cleanMockupImageUrl?: string) => `${currentSignature}|mockup:${mockupImageUrl}|clean:${cleanMockupImageUrl ?? ""}|renderer:${aiBusinessCardPdfRendererVersion}`;

  const markPdfStageRunning = (pdfSignature: string, stage: PdfStage, message: string) => {
    setRunningPdfStages((current) => ({ ...current, [pdfSignature]: stage }));
    setPdfStageErrors((current) => {
      const next = { ...current };

      delete next[pdfSignature];
      return next;
    });
    setPdfProgressMessages((current) => ({ ...current, [pdfSignature]: message }));
    setDownloadState({});
  };

  const clearPdfStageRunning = (pdfSignature: string) => {
    setRunningPdfStages((current) => {
      const next = { ...current };

      delete next[pdfSignature];
      return next;
    });
  };

  const handleDeleteMockup = (mockup: AiBusinessCardMockup) => {
    if (!window.confirm("이 목업 시안을 삭제할까요?")) {
      return;
    }

    saveServerMockups(aiBusinessCardMockups.filter((item) => item.id !== mockup.id));
    deleteAiBusinessCardMockup(mockup.id);
    setDownloadState({});
  };

  const failPdfStage = (pdfSignature: string, message: string) => {
    clearPdfStageRunning(pdfSignature);
    setPdfStageErrors((current) => ({ ...current, [pdfSignature]: message }));
    setPdfProgressMessages((current) => {
      const next = { ...current };

      delete next[pdfSignature];
      return next;
    });
    setDownloadState({ error: message });
  };

  const handleDownloadPdf = async (mockupImageUrl: string, cleanMockupImageUrl?: string) => {
    const pdfSignature = createPdfSignature(mockupImageUrl, cleanMockupImageUrl);
    let pdfDesign: AiBusinessCardDesign | undefined;

    if (!cleanMockupImageUrl) {
      failPdfStage(pdfSignature, "이전 방식으로 만든 목업이라 클린 배경 이미지가 없어요. 새 목업을 다시 생성해 주세요.");
      return;
    }

    beginAiBusinessCardPdfGeneration(pdfSignature);
    markPdfStageRunning(pdfSignature, "render", "PDF 만드는 중: 관리자 템플릿 좌표로 레이아웃을 만들고 있어요.");

    try {
      if (!pdfDesign) {
        const designResponse = await fetchWithTimeout("/api/ai-business-cards/design", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...requestBody(), mockupImageUrl, cleanMockupImageUrl }),
        });

        if (!designResponse.ok) {
          const data: unknown = await designResponse.json().catch(() => undefined);

          throw new Error(readApiErrorReason(data, "관리자 템플릿 좌표로 인쇄용 레이아웃을 만들지 못했어요."));
        }

        const designData = await designResponse.json() as { design?: AiBusinessCardDesign };

        if (!designData.design) {
          throw new Error("선택 목업에서 인쇄용 레이아웃을 만들지 못했어요. 다른 목업으로 다시 시도해 주세요.");
        }

        pdfDesign = designData.design;
      }

      setPdfProgressMessages((current) => ({ ...current, [pdfSignature]: "PDF 만드는 중: SVG 아이콘과 벡터 텍스트를 합치고 있어요." }));

      const response = await fetchWithTimeout("/api/ai-business-cards/pdf", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody(), design: pdfDesign, mockupImageUrl, cleanMockupImageUrl, signature: pdfSignature }),
      });

      const queuedJob = await readAiBusinessCardJob(response);
      const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId);

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.reason);
      }

      if (job.kind !== "pdf" || job.status !== "succeeded") {
        throw new Error("PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요.");
      }

      const blob = createPdfBlobFromBase64(job.base64);
      const fileName = job.fileName || readDownloadFileName(response, `${brandDraft.name || "printy"}-ai-business-card.pdf`);
      const pdfUrl = createPdfBlobUrl(blob);

      finishAiBusinessCardPdfGeneration(pdfSignature, pdfUrl, fileName);
      downloadPdfUrl(pdfUrl, fileName);
      setPdfProgressMessages((current) => {
        const next = { ...current };

        delete next[pdfSignature];
        return next;
      });
      setDownloadState({});
      clearPdfStageRunning(pdfSignature);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "PDF 생성이 오래 걸렸어요. 다시 시도해 주세요." : error instanceof Error ? error.message : "PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요.";

      failAiBusinessCardPdfGeneration(message);
      failPdfStage(pdfSignature, message);
    }
  };

  return (
    <Screen>
      <ProgressHeader eyebrow="AI 명함 생성" title="앞면과 뒷면을 AI로 구성해요" description="먼저 대표 로고와 입력 정보를 기준으로 정면 양면 목업을 만들어요." step={stepNumbers.businessCardPreview} total={onboardingTotalSteps} action={<HomeExitAction />} />
      {editableLayout ? (
        <div className="-mx-3 sm:mx-0">
          <BusinessCardLayoutBuilder layout={editableLayout} orientation={getBusinessCardLayoutOrientation(editableLayout)} managedBackgrounds={[]} mode="user" userFieldValues={{ name: memberDraft.name, role: memberDraft.role, phone: memberDraft.phone, mainPhone: memberDraft.mainPhone, fax: memberDraft.fax, email: memberDraft.email, website: memberDraft.website ?? "", address: memberDraft.address, account: memberDraft.account ?? "", titleLine1: memberDraft.titleLine1 ?? "", titleLine2: memberDraft.titleLine2 ?? "", adLine1: memberDraft.adLine1 ?? "", adLine2: memberDraft.adLine2 ?? "", instagram: memberDraft.instagram ?? "" }} userQrCodeImageUrl={memberDraft.qrCodeImageUrl ?? ""} onOrientationChange={updateLayoutOrientation} onUserFieldValueChange={updateUserFieldValue} onUserQrCodeImageChange={updateUserQrCodeImage} onUserQrCodeImageClear={() => updateMemberDraft("qrCodeImageUrl", "")} onChange={updateLayoutAndProductionOptions} />
        </div>
      ) : null}
      <SoftCard>
        <p className="text-sm font-black text-ink">인쇄용 양면 PDF 생성 방식</p>
        <p className="mt-2 text-xs font-bold leading-5 text-muted">AI가 92x52mm 비율의 앞면 1장, 뒷면 1장을 정면 목업으로 만들어요. 실행 후에는 다른 페이지로 이동해도 되고, 완료되면 상단 알림에 표시돼요.</p>
        <div className="mt-4 grid gap-2">
          <TextAreaField label="목업 디자인 요청" placeholder="예: 검정 배경에 금색 포인트, 여백 넓게, 고급스러운 분위기. 입력한 명함 문구 외 문장은 추가하지 않기." value={mockupRequest} onChange={setMockupRequest} />
          <AppButton onClick={handleGenerateMockups} disabled={!canGenerateMockups || downloadState.status === "mockups" || isGeneratingCurrentMockups} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
            {downloadState.status === "mockups" || isGeneratingCurrentMockups ? "명함 목업 디자인 생성 중" : hasCurrentMockups ? "명함 목업 하나 더 만들기" : "명함 목업 디자인 시작하기"}
          </AppButton>
        </div>
        {!canGenerateMockups ? <p className="mt-3 rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">대표 로고 이미지가 필요해요. 브랜드의 대표 로고를 먼저 생성하거나 등록해 주세요.</p> : null}
        {aiBusinessCardMockupMessage ? <p className="mt-3 rounded-md bg-surface-blue px-4 py-3 text-xs font-bold leading-5 text-muted">{aiBusinessCardMockupMessage}</p> : null}
        {downloadState.error ? <p className="mt-3 rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{downloadState.error}</p> : null}
      </SoftCard>
      {hasCurrentMockups ? (
        <div className="grid gap-3">
          <p className="text-xs font-black text-primary-strong">생성된 정면 양면 시안</p>
          <div className="grid grid-cols-1 gap-3">
            {aiBusinessCardMockups.map((mockup) => {
              const pdfSignature = createPdfSignature(mockup.imageUrl, mockup.cleanImageUrl);
              const pdfRecord = aiBusinessCardPdfRecords[pdfSignature];
              const runningStage = runningPdfStages[pdfSignature];
              const isGeneratingPdf = Boolean(runningStage) || pdfRecord?.status === "generating" || (aiBusinessCardPdfStatus === "generating" && aiBusinessCardPdfSignature === pdfSignature);
              const isReadyPdf = pdfRecord?.status === "ready" && Boolean(pdfRecord.url);
              const hasCleanMockup = Boolean(mockup.cleanImageUrl);
              const pdfProgressMessage = pdfProgressMessages[pdfSignature];
              const pdfStageError = pdfStageErrors[pdfSignature];

              return (
                <div key={mockup.id} className={`overflow-hidden rounded-lg border bg-surface p-2 text-left shadow-card transition ${selectedAiBusinessCardMockupUrl === mockup.imageUrl ? "border-primary ring-4 ring-primary-soft" : "border-line"}`}>
                  <button className="block w-full text-left" type="button" onClick={() => selectAiBusinessCardMockup(mockup.imageUrl)}>
                    <span className="mb-2 block text-[11px] font-black text-muted">일반 목업 이미지</span>
                    <Image className="block h-auto w-full rounded-md bg-surface-blue" src={mockup.imageUrl} alt={`${mockup.title} 일반 목업`} width={920} height={1040} sizes="(max-width: 768px) 100vw, 768px" unoptimized />
                    <span className="mb-2 mt-3 block text-[11px] font-black text-muted">클린 배경 목업 이미지</span>
                    {mockup.cleanImageUrl ? <Image className="block h-auto w-full rounded-md bg-surface-blue" src={mockup.cleanImageUrl} alt={`${mockup.title} 클린 배경`} width={920} height={1040} sizes="(max-width: 768px) 100vw, 768px" unoptimized /> : <span className="block rounded-md bg-danger/10 px-3 py-3 text-[11px] font-black leading-5 text-danger">이 목업은 클린 배경이 없는 이전 버전이에요. 새 목업을 다시 생성해 주세요.</span>}
                    <span className="mt-2 block text-xs font-black text-ink">{mockup.title}</span>
                  </button>
                  <div className="mt-3 grid gap-2">
                    <AppButton variant={isReadyPdf ? "primary" : "secondary"} onClick={() => (isReadyPdf && pdfRecord?.url ? downloadPdfUrl(pdfRecord.url, pdfRecord.fileName ?? `${brandDraft.name || "printy"}-ai-business-card.pdf`) : handleDownloadPdf(mockup.imageUrl, mockup.cleanImageUrl))} disabled={!hasCleanMockup || isGeneratingPdf || Boolean(runningStage)} className={`relative overflow-hidden disabled:cursor-not-allowed disabled:opacity-90 disabled:hover:translate-y-0 ${runningStage ? "shadow-[0_0_0_4px_rgba(47,102,255,0.12)]" : ""}`}>
                      {runningStage ? <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/45 to-transparent" aria-hidden="true" /> : null}
                      <span className="relative z-10">{runningStage === "render" ? "PDF 만드는 중" : isReadyPdf ? "PDF 다운로드" : "PDF 만들기"}</span>
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => handleDeleteMockup(mockup)} disabled={isGeneratingPdf} className="py-3 text-xs text-danger disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                      목업 시안 삭제
                    </AppButton>
                  </div>
                  {pdfProgressMessage ? <p className="mt-2 rounded-md bg-surface-blue px-3 py-2 text-[11px] font-black leading-5 text-primary-strong">{pdfProgressMessage}</p> : null}
                  {pdfStageError ? <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] font-black leading-5 text-danger">{pdfStageError}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
