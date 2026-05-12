"use client";

import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BusinessCardLayoutBuilder, type BusinessCardLayoutManagedBackground } from "@/components/admin/business-card-layout-builder";
import { BusinessCardTemplateRenderer } from "@/components/printy/templates/business-card-template-renderer";
import { AppButton, SoftCard } from "@/components/ui";
import { PrintyBrandLogo } from "@/components/ui/logo";
import { businessCardTemplateStatuses, defaultBusinessCardTemplateLayout, getBusinessCardTemplateOrientation, type BusinessCardTemplateStatus } from "@/lib/business-card-templates";
import type { BusinessCardTemplateBackground, BusinessCardTemplateLayout, LogoReferenceImage, Member, PrintTemplate, ResolvedLogoOption } from "@/lib/types";

type AdminTemplatesResponse = {
  templates: PrintTemplate[];
};

type AdminTemplateResponse = {
  template: PrintTemplate;
};

type AdminBackgroundImageCleanupResponse = {
  deletedCount: number;
  deletedImageUrls: string[];
  deletedBackgrounds: ManagedBusinessCardBackground[];
};

type AdminBackgroundImageUploadResponse = {
  imageUrl: string;
  contentType: "image/png" | "image/jpeg";
  size: number;
  background: ManagedBusinessCardBackground;
};

type AdminBackgroundImageUpdateResponse = {
  background: ManagedBusinessCardBackgroundWithUsage;
};

type AdminBackgroundImagesResponse = {
  backgrounds: ManagedBusinessCardBackgroundWithUsage[];
};

type AdminLogoReferenceImagesResponse = {
  images: LogoReferenceImage[];
};

type AdminLogoReferenceImageUploadResponse = {
  image: LogoReferenceImage;
};

type PublicTemplatesResponse = {
  templates: PrintTemplate[];
};

type AdminFormState = {
  title: string;
  summary: string;
  tagsText: string;
  orientation: "horizontal" | "vertical";
  status: BusinessCardTemplateStatus;
  layout: BusinessCardTemplateLayout;
};

type RequestStatus = "idle" | "loading" | "error" | "success";
type AdminSectionId = "dashboard" | "templates" | "editor" | "settings" | "logoReferences";
type PrepressStatus = "source-only" | "prepress-unavailable" | "pdfx-candidate" | "validation-failed" | "pdfx-validated";

type PrepressCheck = {
  name: string;
  status: "passed" | "failed" | "skipped";
  message: string;
};

type PrepressCheckResponse = {
  status: PrepressStatus;
  notes: string[];
  checks: PrepressCheck[];
  downloadable: boolean;
};

type ManagedBusinessCardBackground = Omit<BusinessCardLayoutManagedBackground, "used" | "usageCount"> & {
  contentType: "image/png" | "image/jpeg" | "image/webp";
  size: number;
  createdAt: string;
  updatedAt: string;
};

type ManagedBusinessCardBackgroundWithUsage = ManagedBusinessCardBackground & {
  used: boolean;
  usageCount: number;
};

const adminSections: Array<{ id: AdminSectionId; label: string; helper: string }> = [
  { id: "dashboard", label: "대시보드", helper: "공개 상태 요약" },
  { id: "templates", label: "명함 템플릿 목록", helper: "편집과 삭제" },
  { id: "editor", label: "새 템플릿 만들기", helper: "생성/수정 빌더" },
  { id: "settings", label: "배경 관리", helper: "공통 설정" },
  { id: "logoReferences", label: "로고 레퍼런스", helper: "참고 이미지 관리" },
];

const adminThumbnailMember: Member = {
  id: "admin-thumbnail-member",
  name: "홍길동",
  role: "브랜드 매니저",
  phone: "010-1234-5678",
  mainPhone: "02-123-4567",
  fax: "02-123-4568",
  email: "hello@printy.kr",
  address: "서울특별시 강남구 프린티로 90",
};

const adminThumbnailLogo: ResolvedLogoOption = {
  id: "admin-thumbnail-logo",
  name: "Printy Studio",
  label: "프린티 스튜디오",
  initial: "P",
  shape: "spark",
  accent: "var(--color-primary-strong)",
  background: "var(--color-primary-soft)",
  description: "관리자 썸네일용 샘플 로고",
};

function cloneBusinessCardTemplateBackground(background: BusinessCardTemplateBackground): BusinessCardTemplateBackground {
  if (!background.enabled) {
    return { enabled: false };
  }

  if (background.type === "color") {
    return { enabled: true, type: "color", color: background.color };
  }

  return background.color ? { enabled: true, type: "image", imageUrl: background.imageUrl, color: background.color } : { enabled: true, type: "image", imageUrl: background.imageUrl };
}

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
        background: cloneBusinessCardTemplateBackground(layout.sides.front.background),
      },
      back: {
        logo: { visible: layout.sides.back.logo.visible, box: { ...layout.sides.back.logo.box } },
        fields: layout.sides.back.fields.map((field) => ({ ...field, box: { ...field.box } })),
        icons: layout.sides.back.icons.map((icon) => ({ ...icon, box: { ...icon.box } })),
        lines: layout.sides.back.lines.map((line) => ({ ...line, box: { ...line.box } })),
        background: cloneBusinessCardTemplateBackground(layout.sides.back.background),
      },
    },
  };
}

function layoutForOrientation(layout: BusinessCardTemplateLayout, orientation: "horizontal" | "vertical"): BusinessCardTemplateLayout {
  const shortSideMm = Math.min(layout.canvas.trim.widthMm, layout.canvas.trim.heightMm);
  const longSideMm = Math.max(layout.canvas.trim.widthMm, layout.canvas.trim.heightMm);

  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      trim: orientation === "horizontal" ? { widthMm: longSideMm, heightMm: shortSideMm } : { widthMm: shortSideMm, heightMm: longSideMm },
    },
  };
}

function createInitialFormState(): AdminFormState {
  return {
    title: "",
    summary: "",
    tagsText: "명함, 브랜드",
    orientation: "horizontal",
    status: "draft",
    layout: cloneBusinessCardTemplateLayout(defaultBusinessCardTemplateLayout),
  };
}

const statusLabels: Record<BusinessCardTemplateStatus, string> = {
  draft: "초안",
  published: "공개",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isManagedBackgroundContentType(value: unknown): value is ManagedBusinessCardBackground["contentType"] {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp";
}

function isUploadBackgroundContentType(value: unknown): value is AdminBackgroundImageUploadResponse["contentType"] {
  return value === "image/png" || value === "image/jpeg";
}

function isManagedBusinessCardBackground(value: unknown): value is ManagedBusinessCardBackground {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === "string" && typeof value.name === "string" && isStringArray(value.tags) && typeof value.imageUrl === "string" && isManagedBackgroundContentType(value.contentType) && typeof value.size === "number" && typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function isManagedBusinessCardBackgroundWithUsage(value: unknown): value is ManagedBusinessCardBackgroundWithUsage {
  if (!isRecord(value)) {
    return false;
  }

  const record = value;
  const used = record.used;
  const usageCount = record.usageCount;

  return isManagedBusinessCardBackground(record) && typeof used === "boolean" && typeof usageCount === "number" && Number.isInteger(usageCount) && usageCount >= 0;
}

function isPrintTemplate(value: unknown): value is PrintTemplate {
  if (!isRecord(value)) {
    return false;
  }

  const orientation = value.orientation;
  const status = value.status;
  const source = value.source;

  return (
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isStringArray(value.tags) &&
    typeof value.createdAt === "string" &&
    (orientation === undefined || orientation === "horizontal" || orientation === "vertical") &&
    (typeof value.previewVariant === "undefined" || typeof value.previewVariant === "string") &&
    (status === undefined || status === "draft" || status === "published") &&
    (source === undefined || source === "seed" || source === "admin")
  );
}

function readAdminTemplatesResponse(value: unknown): AdminTemplatesResponse | undefined {
  if (!isRecord(value) || !Array.isArray(value.templates) || !value.templates.every(isPrintTemplate)) {
    return undefined;
  }

  return { templates: value.templates };
}

function readAdminTemplateResponse(value: unknown): AdminTemplateResponse | undefined {
  if (!isRecord(value) || !isPrintTemplate(value.template)) {
    return undefined;
  }

  return { template: value.template };
}

function readAdminBackgroundImageCleanupResponse(value: unknown): AdminBackgroundImageCleanupResponse | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const deletedCount = value.deletedCount;
  const deletedImageUrls = value.deletedImageUrls;
  const deletedBackgrounds = value.deletedBackgrounds;

  if (typeof deletedCount !== "number" || !Number.isInteger(deletedCount) || deletedCount < 0 || !isStringArray(deletedImageUrls) || !Array.isArray(deletedBackgrounds) || !deletedBackgrounds.every(isManagedBusinessCardBackground)) {
    return undefined;
  }

  return { deletedCount, deletedImageUrls, deletedBackgrounds };
}

function readAdminBackgroundImageUploadResponse(value: unknown): AdminBackgroundImageUploadResponse | undefined {
  if (!isRecord(value) || !isManagedBusinessCardBackground(value.background) || typeof value.imageUrl !== "string" || !isUploadBackgroundContentType(value.contentType) || typeof value.size !== "number") {
    return undefined;
  }

  return { imageUrl: value.imageUrl, contentType: value.contentType, size: value.size, background: value.background };
}

function readAdminBackgroundImageUpdateResponse(value: unknown): AdminBackgroundImageUpdateResponse | undefined {
  if (!isRecord(value) || !isManagedBusinessCardBackgroundWithUsage(value.background)) {
    return undefined;
  }

  return { background: value.background };
}

function readAdminBackgroundImagesResponse(value: unknown): AdminBackgroundImagesResponse | undefined {
  if (!isRecord(value) || !Array.isArray(value.backgrounds) || !value.backgrounds.every(isManagedBusinessCardBackgroundWithUsage)) {
    return undefined;
  }

  return { backgrounds: value.backgrounds };
}

function isLogoReferenceImage(value: unknown): value is LogoReferenceImage {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === "string" && typeof value.name === "string" && typeof value.imageUrl === "string" && (value.contentType === "image/png" || value.contentType === "image/jpeg") && typeof value.size === "number" && typeof value.createdAt === "string";
}

function readAdminLogoReferenceImagesResponse(value: unknown): AdminLogoReferenceImagesResponse | undefined {
  if (!isRecord(value) || !Array.isArray(value.images) || !value.images.every(isLogoReferenceImage)) {
    return undefined;
  }

  return { images: value.images };
}

function readAdminLogoReferenceImageUploadResponse(value: unknown): AdminLogoReferenceImageUploadResponse | undefined {
  if (!isRecord(value) || !isLogoReferenceImage(value.image)) {
    return undefined;
  }

  return { image: value.image };
}

function readApiErrorReason(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.reason === "string" ? value.reason : fallback;
}

function readPrepressCheckResponse(value: unknown): PrepressCheckResponse | undefined {
  if (!isRecord(value) || typeof value.status !== "string" || !Array.isArray(value.notes) || !Array.isArray(value.checks) || typeof value.downloadable !== "boolean") {
    return undefined;
  }

  const statuses: PrepressStatus[] = ["source-only", "prepress-unavailable", "pdfx-candidate", "validation-failed", "pdfx-validated"];

  if (!statuses.includes(value.status as PrepressStatus) || !value.notes.every((note) => typeof note === "string")) {
    return undefined;
  }

  const checks = value.checks.filter((check): check is PrepressCheck => isRecord(check) && typeof check.name === "string" && (check.status === "passed" || check.status === "failed" || check.status === "skipped") && typeof check.message === "string");

  if (checks.length !== value.checks.length) {
    return undefined;
  }

  return { status: value.status as PrepressStatus, notes: value.notes, checks, downloadable: value.downloadable };
}

function readPublicTemplatesResponse(value: unknown): PublicTemplatesResponse | undefined {
  if (!isRecord(value) || !Array.isArray(value.templates) || !value.templates.every(isPrintTemplate)) {
    return undefined;
  }

  return { templates: value.templates };
}

function formStateFromTemplate(template: PrintTemplate): AdminFormState {
  const status = businessCardTemplateStatuses.find((item) => item === template.status) ?? "draft";
  const orientation = getBusinessCardTemplateOrientation(template);

  return {
    title: template.title,
    summary: template.summary,
    tagsText: template.tags.join(", "),
    orientation,
    status,
    layout: layoutForOrientation(cloneBusinessCardTemplateLayout(template.layout ?? defaultBusinessCardTemplateLayout), orientation),
  };
}

function buildTemplatePayload(form: AdminFormState) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    tags: form.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index),
    orientation: form.orientation,
    status: form.status,
    layout: form.layout,
  };
}

function buildDraftPdfPayload(form: AdminFormState) {
  const payload = buildTemplatePayload(form);

  return {
    ...payload,
    title: payload.title || "새 명함 템플릿",
    summary: payload.summary || "관리자 PDF 확인용 초안",
    tags: payload.tags.length > 0 ? payload.tags : ["명함"],
  };
}

function safeDownloadFileName(value: string) {
  const fileNameBase = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "draft-preview";

  return `printy-business-card-${fileNameBase}-print-shop.pdf`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AdminTemplateManager() {
  const [contact, setContact] = useState("01000000000");
  const [token, setToken] = useState("test-admin-token");
  const [authenticated, setAuthenticated] = useState(false);
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [form, setForm] = useState<AdminFormState>(() => createInitialFormState());
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [message, setMessage] = useState("관리자 토큰은 브라우저 저장소에 저장하지 않아요.");
  const [publicTemplateCount, setPublicTemplateCount] = useState<number>();
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaningBackgroundImages, setIsCleaningBackgroundImages] = useState(false);
  const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] = useState(false);
  const [deletingBackgroundId, setDeletingBackgroundId] = useState<string>();
  const [updatingBackgroundId, setUpdatingBackgroundId] = useState<string>();
  const [managedBackgrounds, setManagedBackgrounds] = useState<ManagedBusinessCardBackgroundWithUsage[]>([]);
  const [backgroundName, setBackgroundName] = useState("");
  const [backgroundTagsText, setBackgroundTagsText] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File>();
  const [backgroundFileInputKey, setBackgroundFileInputKey] = useState(0);
  const [logoReferenceImages, setLogoReferenceImages] = useState<LogoReferenceImage[]>([]);
  const [logoReferenceFile, setLogoReferenceFile] = useState<File>();
  const [logoReferenceFileInputKey, setLogoReferenceFileInputKey] = useState(0);
  const [isUploadingLogoReferenceImage, setIsUploadingLogoReferenceImage] = useState(false);
  const [deletingLogoReferenceImageId, setDeletingLogoReferenceImageId] = useState<string>();
  const [updatingLogoReferenceImageId, setUpdatingLogoReferenceImageId] = useState<string>();
  const [activeSection, setActiveSection] = useState<AdminSectionId>("dashboard");

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedTemplateId), [selectedTemplateId, templates]);
  const publishedCount = templates.filter((template) => template.status === "published").length;
  const draftCount = templates.filter((template) => template.status !== "published").length;
  const backgroundFilePreviewUrl = useMemo(() => (backgroundFile ? URL.createObjectURL(backgroundFile) : ""), [backgroundFile]);

  useEffect(() => {
    if (!backgroundFilePreviewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(backgroundFilePreviewUrl);
  }, [backgroundFilePreviewUrl]);

  const updateForm = <K extends keyof AdminFormState>(field: K, value: AdminFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const loadTemplates = async (preferredTemplateId?: string, selectFirst = true) => {
    const response = await fetch("/api/admin/templates", { credentials: "include", cache: "no-store" });

    if (!response.ok) {
      setAuthenticated(false);
      throw new Error("관리자 템플릿을 불러오지 못했어요.");
    }

    const data = readAdminTemplatesResponse(await response.json());

    if (!data) {
      throw new Error("관리자 템플릿 응답이 올바르지 않아요.");
    }

    const nextSelectedTemplate =
      (preferredTemplateId ? data.templates.find((template) => template.id === preferredTemplateId) : undefined) ??
      (selectedTemplateId ? data.templates.find((template) => template.id === selectedTemplateId) : undefined) ??
      (selectFirst ? data.templates[0] : undefined);

    setTemplates(data.templates);
    setSelectedTemplateId(nextSelectedTemplate?.id);
    setForm(nextSelectedTemplate ? formStateFromTemplate(nextSelectedTemplate) : createInitialFormState());
  };

  const loadManagedBackgrounds = async () => {
    const response = await fetch("/api/admin/business-card-background-images", { credentials: "include", cache: "no-store" });

    if (!response.ok) {
      setAuthenticated(false);
      throw new Error("등록 배경을 불러오지 못했어요.");
    }

    const data = readAdminBackgroundImagesResponse(await response.json());

    if (!data) {
      throw new Error("등록 배경 응답이 올바르지 않아요.");
    }

    setManagedBackgrounds(data.backgrounds);
  };

  const loadLogoReferenceImages = async () => {
    const response = await fetch("/api/admin/logo-reference-images", { credentials: "include", cache: "no-store" });

    if (!response.ok) {
      setAuthenticated(false);
      throw new Error("로고 참고 이미지를 불러오지 못했어요.");
    }

    const data = readAdminLogoReferenceImagesResponse(await response.json());

    if (!data) {
      throw new Error("로고 참고 이미지 응답이 올바르지 않아요.");
    }

    setLogoReferenceImages(data.images);
  };

  const refreshPublicTemplates = async () => {
    const response = await fetch("/api/templates", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("공개 템플릿 동기화 확인에 실패했어요.");
    }

    const data = readPublicTemplatesResponse(await response.json());

    if (!data) {
      throw new Error("공개 템플릿 응답이 올바르지 않아요.");
    }

    setPublicTemplateCount(data.templates.length);
  };

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("관리자 권한을 확인하고 있어요.");

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contact, token }),
      });

      if (!response.ok) {
        throw new Error("연락처 또는 토큰이 맞지 않아요.");
      }

      setAuthenticated(true);
      setToken("");
      await Promise.all([loadTemplates(), refreshPublicTemplates(), loadManagedBackgrounds(), loadLogoReferenceImages()]);
      setActiveSection("dashboard");
      setStatus("success");
      setMessage("관리자 화면이 열렸어요. 토큰은 화면 상태에서만 사용했어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "잠금 해제에 실패했어요.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE", credentials: "include" });
    setAuthenticated(false);
    setTemplates([]);
    setManagedBackgrounds([]);
    setSelectedTemplateId(undefined);
    setToken("");
    setBackgroundName("");
    setBackgroundTagsText("");
    setBackgroundFile(undefined);
    setBackgroundFileInputKey((current) => current + 1);
    setLogoReferenceImages([]);
    setLogoReferenceFile(undefined);
    setLogoReferenceFileInputKey((current) => current + 1);
    setActiveSection("dashboard");
    setStatus("idle");
    setMessage("관리자 세션을 종료했어요.");
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(undefined);
    setForm(createInitialFormState());
    setActiveSection("editor");
    setMessage("새 명함 템플릿 초안을 작성해 주세요.");
  };

  const handleSelectTemplate = (template: PrintTemplate) => {
    setSelectedTemplateId(template.id);
    setForm(formStateFromTemplate(template));
    setActiveSection("editor");
    setMessage(`${template.title} 템플릿을 편집 중이에요.`);
  };

  const handleCopyTemplate = (template: PrintTemplate) => {
    const copiedForm = formStateFromTemplate(template);

    setSelectedTemplateId(undefined);
    setForm({ ...copiedForm, title: `${copiedForm.title} 복사본`, status: "draft" });
    setActiveSection("editor");
    setMessage(`${template.title} 템플릿을 복사했어요. 저장하면 새 템플릿으로 생성돼요.`);
  };

  const handleSubmitTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatus("loading");

    try {
      const payload = buildTemplatePayload(form);
      const response = await fetch(selectedTemplate ? `/api/admin/templates/${selectedTemplate.id}` : "/api/admin/templates", {
        method: selectedTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("저장할 수 없어요. 제목, 요약, 태그 길이를 확인해 주세요.");
      }

      const data = readAdminTemplateResponse(await response.json());

      if (!data) {
        throw new Error("저장 응답이 올바르지 않아요.");
      }

      await loadTemplates(data.template.id);
      await refreshPublicTemplates();
      await loadManagedBackgrounds();
      setStatus("success");
      setMessage(data.template.status === "published" ? "저장했고 공개 템플릿 목록도 다시 확인했어요." : "초안으로 저장했어요. 공개 전까지 앱에는 노출되지 않아요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "템플릿 저장에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (template: PrintTemplate) => {
    setIsSaving(true);
    setStatus("loading");

    try {
      const response = await fetch(`/api/admin/templates/${template.id}`, { method: "DELETE", credentials: "include" });

      if (!response.ok) {
        throw new Error("삭제할 수 없어요.");
      }

      await loadTemplates(undefined, false);
      await refreshPublicTemplates();
      await loadManagedBackgrounds();
      setStatus("success");
      setMessage("템플릿을 삭제하고 공개 목록을 다시 확인했어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "템플릿 삭제에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) {
      return;
    }

    await deleteTemplate(selectedTemplate);
  };

  const handleBackgroundFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setBackgroundFile(event.target.files?.[0]);
  };

  const handleLogoReferenceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLogoReferenceFile(event.target.files?.[0]);
  };

  const handleUploadLogoReferenceImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!logoReferenceFile) {
      setStatus("error");
      setMessage("등록할 로고 참고 이미지를 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", logoReferenceFile);
    setIsUploadingLogoReferenceImage(true);
    setStatus("loading");
    setMessage("로고 참고 이미지를 등록하고 있어요.");

    try {
      const response = await fetch("/api/admin/logo-reference-images", { method: "POST", credentials: "include", body: formData });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "로고 참고 이미지를 등록하지 못했어요."));
      }

      if (!readAdminLogoReferenceImageUploadResponse(data)) {
        throw new Error("로고 참고 이미지 등록 응답이 올바르지 않아요.");
      }

      await loadLogoReferenceImages();
      setLogoReferenceFile(undefined);
      setLogoReferenceFileInputKey((current) => current + 1);
      setStatus("success");
      setMessage("로고 참고 이미지를 등록했어요. 사용자 로고 제작 화면에서 선택할 수 있어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "로고 참고 이미지를 등록하지 못했어요.");
    } finally {
      setIsUploadingLogoReferenceImage(false);
    }
  };

  const handleDeleteLogoReferenceImage = async (image: LogoReferenceImage) => {
    setDeletingLogoReferenceImageId(image.id);
    setStatus("loading");
    setMessage("로고 참고 이미지를 삭제하고 있어요.");

    try {
      const response = await fetch(`/api/admin/logo-reference-images?id=${encodeURIComponent(image.id)}`, { method: "DELETE", credentials: "include" });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "로고 참고 이미지를 삭제하지 못했어요."));
      }

      await loadLogoReferenceImages();
      setStatus("success");
      setMessage("로고 참고 이미지를 삭제했어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "로고 참고 이미지를 삭제하지 못했어요.");
    } finally {
      setDeletingLogoReferenceImageId(undefined);
    }
  };

  const handleUpdateLogoReferenceForcedInstructions = async (image: LogoReferenceImage, forcedInstructions: string) => {
    setUpdatingLogoReferenceImageId(image.id);
    setStatus("loading");
    setMessage("로고 레퍼런스 강제사항을 저장하고 있어요.");

    try {
      const response = await fetch("/api/admin/logo-reference-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: image.id, forcedInstructions }),
      });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "로고 레퍼런스 강제사항을 저장하지 못했어요."));
      }

      await loadLogoReferenceImages();
      setStatus("success");
      setMessage("로고 레퍼런스 강제사항을 저장했어요. 생성 요청에 함께 반영돼요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "로고 레퍼런스 강제사항을 저장하지 못했어요.");
    } finally {
      setUpdatingLogoReferenceImageId(undefined);
    }
  };

  const handleUploadManagedBackground = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!backgroundFile) {
      setStatus("error");
      setMessage("등록할 배경 이미지 파일을 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", backgroundFile);

    const trimmedName = backgroundName.trim();
    const trimmedTags = backgroundTagsText.trim();

    if (trimmedName.length > 0) {
      formData.append("name", trimmedName);
    }

    if (trimmedTags.length > 0) {
      formData.append("tags", trimmedTags);
    }

    setIsUploadingBackgroundImage(true);
    setStatus("loading");
    setMessage("명함 배경을 라이브러리에 등록하고 있어요.");

    try {
      const response = await fetch("/api/admin/business-card-background-images", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "배경 이미지를 등록하지 못했어요."));
      }

      if (!readAdminBackgroundImageUploadResponse(data)) {
        throw new Error("배경 이미지 등록 응답이 올바르지 않아요.");
      }

      await loadManagedBackgrounds();
      setBackgroundName("");
      setBackgroundTagsText("");
      setBackgroundFile(undefined);
      setBackgroundFileInputKey((current) => current + 1);
      setStatus("success");
      setMessage("배경 이미지를 등록했고 새 템플릿 빌더에서 선택할 수 있어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "배경 이미지를 등록하지 못했어요.");
    } finally {
      setIsUploadingBackgroundImage(false);
    }
  };

  const handleDeleteManagedBackground = async (background: ManagedBusinessCardBackgroundWithUsage) => {
    setDeletingBackgroundId(background.id);
    setStatus("loading");
    setMessage(`${background.name} 배경을 삭제하고 있어요.`);

    try {
      const response = await fetch(`/api/admin/business-card-background-images?id=${encodeURIComponent(background.id)}`, { method: "DELETE", credentials: "include" });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "배경 이미지를 삭제하지 못했어요."));
      }

      await loadManagedBackgrounds();
      setStatus("success");
      setMessage("사용하지 않는 배경 이미지를 삭제했어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "배경 이미지를 삭제하지 못했어요.");
    } finally {
      setDeletingBackgroundId(undefined);
    }
  };

  const handleUpdateManagedBackground = async (background: ManagedBusinessCardBackgroundWithUsage, name: string, tagsText: string) => {
    setUpdatingBackgroundId(background.id);
    setStatus("loading");
    setMessage(`${background.name} 배경 정보를 수정하고 있어요.`);

    try {
      const response = await fetch("/api/admin/business-card-background-images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: background.id,
          name,
          tags: tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index),
        }),
      });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "배경 정보를 수정하지 못했어요."));
      }

      if (!readAdminBackgroundImageUpdateResponse(data)) {
        throw new Error("배경 정보 수정 응답이 올바르지 않아요.");
      }

      await loadManagedBackgrounds();
      setStatus("success");
      setMessage("배경 이름과 태그를 수정했어요.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "배경 정보를 수정하지 못했어요.");
    } finally {
      setUpdatingBackgroundId(undefined);
    }
  };

  const handleCleanupBackgroundImages = async () => {
    setIsCleaningBackgroundImages(true);
    setStatus("loading");
    setMessage("사용하지 않는 배경 이미지를 정리하고 있어요.");

    try {
      const response = await fetch("/api/admin/business-card-background-images", { method: "DELETE", credentials: "include" });

      if (!response.ok) {
        throw new Error("배경 이미지 정리에 실패했어요.");
      }

      const data = readAdminBackgroundImageCleanupResponse(await response.json());

      if (!data) {
        throw new Error("배경 이미지 정리 응답이 올바르지 않아요.");
      }

      await loadManagedBackgrounds();
      setStatus("success");
      setMessage(`사용하지 않는 배경 이미지 ${data.deletedCount}개를 삭제했어요.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "배경 이미지 정리에 실패했어요.");
    } finally {
      setIsCleaningBackgroundImages(false);
    }
  };

  const handleSectionChange = (sectionId: AdminSectionId) => {
    if (sectionId === "editor") {
      handleNewTemplate();
      return;
    }

    setActiveSection(sectionId);
  };

  const activePanel =
    activeSection === "dashboard" ? (
      <DashboardPanel templates={templates} publishedCount={publishedCount} draftCount={draftCount} publicTemplateCount={publicTemplateCount} status={status} message={message} selectedTemplate={selectedTemplate} />
    ) : activeSection === "templates" ? (
      <TemplateListPanel templates={templates} selectedTemplateId={selectedTemplateId} isSaving={isSaving} onSelectTemplate={handleSelectTemplate} onCopyTemplate={handleCopyTemplate} onDeleteTemplate={deleteTemplate} />
    ) : activeSection === "settings" ? (
      <CommonSettingsPanel backgrounds={managedBackgrounds} backgroundName={backgroundName} backgroundTagsText={backgroundTagsText} backgroundFile={backgroundFile} backgroundFilePreviewUrl={backgroundFilePreviewUrl} backgroundFileInputKey={backgroundFileInputKey} status={status} message={message} isUploadingBackgroundImage={isUploadingBackgroundImage} isCleaningBackgroundImages={isCleaningBackgroundImages} deletingBackgroundId={deletingBackgroundId} updatingBackgroundId={updatingBackgroundId} onBackgroundNameChange={setBackgroundName} onBackgroundTagsTextChange={setBackgroundTagsText} onBackgroundFileChange={handleBackgroundFileChange} onUploadBackground={handleUploadManagedBackground} onUpdateBackground={handleUpdateManagedBackground} onDeleteBackground={handleDeleteManagedBackground} onCleanupBackgroundImages={handleCleanupBackgroundImages} />
    ) : activeSection === "logoReferences" ? (
      <LogoReferencePanel logoReferenceImages={logoReferenceImages} logoReferenceFile={logoReferenceFile} logoReferenceFileInputKey={logoReferenceFileInputKey} status={status} message={message} isUploadingLogoReferenceImage={isUploadingLogoReferenceImage} deletingLogoReferenceImageId={deletingLogoReferenceImageId} updatingLogoReferenceImageId={updatingLogoReferenceImageId} onLogoReferenceFileChange={handleLogoReferenceFileChange} onUploadLogoReferenceImage={handleUploadLogoReferenceImage} onDeleteLogoReferenceImage={handleDeleteLogoReferenceImage} onUpdateForcedInstructions={handleUpdateLogoReferenceForcedInstructions} />
    ) : (
      <TemplateEditorPanel form={form} selectedTemplate={selectedTemplate} managedBackgrounds={managedBackgrounds} status={status} message={message} isSaving={isSaving} onChange={updateForm} onSubmit={handleSubmitTemplate} onDelete={handleDeleteTemplate} />
    );

  return (
    <main className="grain min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="animate-float-in rounded-[28px] border border-white/80 bg-white/86 p-5 shadow-floating backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <PrintyBrandLogo size="sm" />
              <div>
                <p className="text-xs font-black text-primary-strong">관리자 템플릿 센터</p>
                <h1 className="mt-1 text-3xl font-black tracking-[-0.05em] text-ink sm:text-4xl">명함 템플릿을 공개까지 관리해요</h1>
                <p className="mt-2 text-sm font-bold leading-6 text-muted">구조화된 입력만 지원하며, 자유형 캔버스 편집기는 아직 열지 않았어요.</p>
              </div>
            </div>
            {authenticated ? (
              <button className="rounded-md bg-surface-blue px-4 py-3 text-sm font-black text-primary-strong transition hover:-translate-y-0.5" type="button" onClick={handleLogout}>
                관리자 잠그기
              </button>
            ) : null}
          </div>
        </header>

        {!authenticated ? (
          <UnlockPanel contact={contact} token={token} status={status} message={message} onContactChange={setContact} onTokenChange={setToken} onSubmit={handleUnlock} />
        ) : (
          <AdminShell activeSection={activeSection} templatesCount={templates.length} selectedTemplate={selectedTemplate} onSectionChange={handleSectionChange} onLogout={handleLogout}>
            {activePanel}
          </AdminShell>
        )}
      </section>
    </main>
  );
}

function UnlockPanel({ contact, token, status, message, onContactChange, onTokenChange, onSubmit }: { contact: string; token: string; status: RequestStatus; message: string; onContactChange: (value: string) => void; onTokenChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <SoftCard className="mx-auto w-full max-w-xl bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-5 sm:p-6">
      <div className="mb-5">
        <span className="rounded-md bg-primary px-3 py-1 text-xs font-black text-white shadow-soft">잠금 해제</span>
        <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-ink">관리자 연락처와 토큰을 입력해 주세요</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">토큰은 화면 상태로만 전송하고 저장하지 않아요.</p>
      </div>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <AdminTextField label="관리자 연락처" value={contact} placeholder="01012345678" autoComplete="username" onChange={onContactChange} />
        <AdminTextField label="관리자 토큰" value={token} placeholder="토큰 입력" type="password" autoComplete="current-password" onChange={onTokenChange} />
        <StatusMessage status={status} message={message} />
        <AppButton type="submit">관리자 열기</AppButton>
      </form>
    </SoftCard>
  );
}

function AdminShell({ activeSection, templatesCount, selectedTemplate, children, onSectionChange, onLogout }: { activeSection: AdminSectionId; templatesCount: number; selectedTemplate?: PrintTemplate; children: ReactNode; onSectionChange: (sectionId: AdminSectionId) => void; onLogout: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-4 lg:items-start">
      <aside className="rounded-lg border border-line bg-surface p-3 shadow-card lg:sticky lg:top-6">
        <div className="rounded-lg bg-[linear-gradient(180deg,var(--color-surface-blue)_0%,var(--color-surface)_100%)] p-4">
          <p className="text-xs font-black text-primary-strong">관리 메뉴</p>
          <p className="mt-1 text-xl font-black tracking-[-0.05em] text-ink">템플릿 운영실</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">{templatesCount}개 템플릿을 왼쪽 메뉴에서 분리해 관리해요.</p>
        </div>
        <nav className="mt-3 grid gap-2" aria-label="관리자 섹션">
          {adminSections.map((section) => (
            <button key={section.id} className={`rounded-lg px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 ${activeSection === section.id ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong hover:bg-primary-soft"}`} type="button" onClick={() => onSectionChange(section.id)}>
              <span className="block text-sm font-black">{section.label}</span>
              <span className={`mt-1 block text-xs font-bold ${activeSection === section.id ? "text-white/82" : "text-muted"}`}>{section.id === "editor" && selectedTemplate ? "선택 템플릿 편집 중" : section.helper}</span>
            </button>
          ))}
        </nav>
        <button className="mt-3 w-full rounded-md bg-surface px-4 py-3 text-sm font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5" type="button" onClick={onLogout}>
          관리자 잠그기
        </button>
      </aside>
      <div className="min-w-0 lg:col-span-3">{children}</div>
    </div>
  );
}

function DashboardPanel({ templates, publishedCount, draftCount, publicTemplateCount, status, message, selectedTemplate }: { templates: PrintTemplate[]; publishedCount: number; draftCount: number; publicTemplateCount?: number; status: RequestStatus; message: string; selectedTemplate?: PrintTemplate }) {
  const syncLabel = publicTemplateCount === undefined ? "확인 전" : publicTemplateCount === publishedCount ? "동기화됨" : "확인 필요";

  return (
    <div className="grid gap-4">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black text-primary-strong">대시보드</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-0.05em] text-ink">명함 템플릿 운영 상태</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">편집 버튼 없이 공개 수, 초안 수, 앱 공개 목록 동기화 상태만 빠르게 확인해요.</p>
          </div>
          <span className="rounded-md bg-surface px-4 py-2 text-xs font-black text-primary-strong shadow-soft">{syncLabel}</span>
        </div>
        <div className="mt-6 grid gap-3 text-center sm:grid-cols-4">
          <Metric label="전체" value={`${templates.length}`} />
          <Metric label="공개" value={`${publishedCount}`} />
          <Metric label="초안" value={`${draftCount}`} />
          <Metric label="앱 목록" value={publicTemplateCount === undefined ? "-" : `${publicTemplateCount}`} />
        </div>
      </SoftCard>
      <SoftCard>
        <p className="text-xs font-black text-primary-strong">최근 작업 상태</p>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">{selectedTemplate ? `${selectedTemplate.title} 템플릿이 현재 선택되어 있어요.` : "선택된 템플릿 없이 새 작업을 시작할 수 있어요."}</p>
        <div className="mt-4">
          <StatusMessage status={status} message={message} />
        </div>
      </SoftCard>
    </div>
  );
}

function TemplateListPanel({ templates, selectedTemplateId, isSaving, onSelectTemplate, onCopyTemplate, onDeleteTemplate }: { templates: PrintTemplate[]; selectedTemplateId?: string; isSaving: boolean; onSelectTemplate: (template: PrintTemplate) => void; onCopyTemplate: (template: PrintTemplate) => void; onDeleteTemplate: (template: PrintTemplate) => void }) {
  return (
    <section className="grid content-start gap-4">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-5 sm:p-6">
        <p className="text-xs font-black text-primary-strong">명함 템플릿 목록</p>
        <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">{templates.length}개 관리 중</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">앞면 레이아웃 썸네일과 함께 템플릿을 고르고, 목록에서 바로 편집하거나 삭제해요.</p>
      </SoftCard>
      <div className="grid gap-3">
        {templates.length === 0 ? (
          <SoftCard>
            <p className="text-sm font-black text-ink">아직 관리자 템플릿이 없어요.</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">새 템플릿을 만들고 공개 상태로 저장하면 앱의 템플릿 선택 화면에 함께 표시돼요.</p>
          </SoftCard>
        ) : null}
        {templates.map((template) => (
          <article key={template.id} className={`rounded-lg border p-4 shadow-card transition duration-200 hover:-translate-y-0.5 ${selectedTemplateId === template.id ? "border-primary bg-surface-blue ring-4 ring-primary-soft" : "border-line bg-surface hover:border-primary-soft"}`}>
            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
              <AdminTemplateThumbnail template={template} />
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{getBusinessCardTemplateOrientation(template) === "horizontal" ? "가로형" : "세로형"}</span>
                  <span className={`rounded-md px-3 py-1 text-xs font-black ${template.status === "published" ? "bg-success text-white" : "bg-warning text-white"}`}>{template.status === "published" ? "공개" : "초안"}</span>
                </div>
                <p className="text-lg font-black tracking-[-0.04em] text-ink">{template.title}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-muted">{template.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-surface px-3 py-1 text-xs font-black text-primary-strong">#{tag}</span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5" type="button" onClick={() => onSelectTemplate(template)}>
                    편집
                  </button>
                  <button className="rounded-md bg-surface-blue px-4 py-3 text-sm font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" onClick={() => onCopyTemplate(template)} disabled={isSaving}>
                    복사해서 새로 만들기
                  </button>
                  <button className="rounded-md bg-danger px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" onClick={() => onDeleteTemplate(template)} disabled={isSaving}>
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CommonSettingsPanel({ backgrounds, backgroundName, backgroundTagsText, backgroundFile, backgroundFilePreviewUrl, backgroundFileInputKey, status, message, isUploadingBackgroundImage, isCleaningBackgroundImages, deletingBackgroundId, updatingBackgroundId, onBackgroundNameChange, onBackgroundTagsTextChange, onBackgroundFileChange, onUploadBackground, onUpdateBackground, onDeleteBackground, onCleanupBackgroundImages }: { backgrounds: ManagedBusinessCardBackgroundWithUsage[]; backgroundName: string; backgroundTagsText: string; backgroundFile?: File; backgroundFilePreviewUrl: string; backgroundFileInputKey: number; status: RequestStatus; message: string; isUploadingBackgroundImage: boolean; isCleaningBackgroundImages: boolean; deletingBackgroundId?: string; updatingBackgroundId?: string; onBackgroundNameChange: (value: string) => void; onBackgroundTagsTextChange: (value: string) => void; onBackgroundFileChange: (event: ChangeEvent<HTMLInputElement>) => void; onUploadBackground: (event: FormEvent<HTMLFormElement>) => void; onUpdateBackground: (background: ManagedBusinessCardBackgroundWithUsage, name: string, tagsText: string) => void; onDeleteBackground: (background: ManagedBusinessCardBackgroundWithUsage) => void; onCleanupBackgroundImages: () => void }) {
  return (
    <div className="grid gap-4">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black text-primary-strong">공통 설정</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">배경 관리</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">명함 빌더에서 고를 배경을 여기에서만 등록하고, 사용 여부는 서버 사용량 기준으로 확인해요.</p>
          </div>
          <button className="rounded-md bg-surface px-4 py-3 text-sm font-black text-primary-strong shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" onClick={onCleanupBackgroundImages} disabled={isCleaningBackgroundImages}>
            {isCleaningBackgroundImages ? "정리 중" : "사용 안 함 배경 정리"}
          </button>
        </div>
        <form className="mt-5 grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-soft xl:grid-cols-[1fr_1fr_220px] xl:items-end" onSubmit={onUploadBackground}>
          <AdminTextField label="배경 이름" value={backgroundName} placeholder="예: 블루 그레인 배경" maxLength={120} onChange={onBackgroundNameChange} />
          <AdminTextField label="태그" value={backgroundTagsText} placeholder="쉼표로 구분: 프리미엄, 블루" onChange={onBackgroundTagsTextChange} />
          <div className="grid gap-3">
            <label className="block rounded-md border border-dashed border-primary-soft bg-surface-blue p-3">
              <span className="mb-2 block text-xs font-extrabold text-primary-strong">파일 업로드</span>
              <input key={backgroundFileInputKey} className="block w-full text-xs font-bold text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-black file:text-white disabled:cursor-not-allowed disabled:opacity-60" type="file" accept="image/png,image/jpeg" disabled={isUploadingBackgroundImage} onChange={onBackgroundFileChange} />
            </label>
            <button className="rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="submit" disabled={isUploadingBackgroundImage || !backgroundFile}>
              {isUploadingBackgroundImage ? "등록 중" : "배경 등록"}
            </button>
          </div>
          <div className="xl:col-span-3">
            <div className="grid gap-3 rounded-md bg-surface-blue p-3 sm:grid-cols-[132px_1fr] sm:items-center">
              <div className="h-20 overflow-hidden rounded-md border border-line bg-surface shadow-soft">
                {backgroundFilePreviewUrl ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(backgroundFilePreviewUrl)})` }} /> : <div className="grid h-full place-items-center text-xs font-black text-soft">미리보기</div>}
              </div>
              <p className="text-xs font-bold leading-5 text-muted">인쇄소 전달 PDF와 동일하게 PNG 또는 JPG 이미지를 5MB 이하로 올릴 수 있어요. 이름이 비어 있으면 파일명을 사용하고, 태그는 쉼표로 나눠 저장해요.</p>
            </div>
          </div>
        </form>
        <div className="mt-4">
          <StatusMessage status={status} message={message} />
        </div>
      </SoftCard>

      <section className="grid gap-3">
        {backgrounds.length === 0 ? (
          <SoftCard>
            <p className="text-sm font-black text-ink">등록된 배경이 아직 없어요.</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">배경을 등록하면 새 템플릿 빌더의 배경 선택 목록에 바로 표시돼요.</p>
          </SoftCard>
        ) : null}
        {backgrounds.map((background) => (
          <BackgroundLibraryItem key={background.id} background={background} deletingBackgroundId={deletingBackgroundId} updatingBackgroundId={updatingBackgroundId} onUpdateBackground={onUpdateBackground} onDeleteBackground={onDeleteBackground} />
        ))}
      </section>
    </div>
  );
}

function LogoReferencePanel({ logoReferenceImages, logoReferenceFile, logoReferenceFileInputKey, status, message, isUploadingLogoReferenceImage, deletingLogoReferenceImageId, updatingLogoReferenceImageId, onLogoReferenceFileChange, onUploadLogoReferenceImage, onDeleteLogoReferenceImage, onUpdateForcedInstructions }: { logoReferenceImages: LogoReferenceImage[]; logoReferenceFile?: File; logoReferenceFileInputKey: number; status: RequestStatus; message: string; isUploadingLogoReferenceImage: boolean; deletingLogoReferenceImageId?: string; updatingLogoReferenceImageId?: string; onLogoReferenceFileChange: (event: ChangeEvent<HTMLInputElement>) => void; onUploadLogoReferenceImage: (event: FormEvent<HTMLFormElement>) => void; onDeleteLogoReferenceImage: (image: LogoReferenceImage) => void; onUpdateForcedInstructions: (image: LogoReferenceImage, forcedInstructions: string) => void }) {
  return (
    <div className="grid gap-4">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black text-primary-strong">로고 레퍼런스</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">사용자 로고 제작 참고 이미지</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">레퍼런스 이미지는 생성 요청 때 원본 이미지로 첨부하고, 강제사항은 프롬프트에 함께 반영해요.</p>
          </div>
          <span className="rounded-md bg-surface px-4 py-3 text-sm font-black text-primary-strong shadow-soft">{logoReferenceImages.length}개 등록</span>
        </div>
        <form className="mt-5 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={onUploadLogoReferenceImage}>
          <label className="block rounded-md border border-dashed border-primary-soft bg-surface-blue p-3">
            <span className="mb-2 block text-xs font-extrabold text-primary-strong">참고 이미지 업로드</span>
            <input key={logoReferenceFileInputKey} className="block w-full text-xs font-bold text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-black file:text-white disabled:cursor-not-allowed disabled:opacity-60" type="file" accept="image/png,image/jpeg" disabled={isUploadingLogoReferenceImage} onChange={onLogoReferenceFileChange} />
            <span className="mt-2 block text-xs font-bold text-muted">PNG/JPG, 5MB 이하</span>
          </label>
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="submit" disabled={isUploadingLogoReferenceImage || !logoReferenceFile}>
            {isUploadingLogoReferenceImage ? "등록 중" : "참고 이미지 등록"}
          </button>
        </form>
        <div className="mt-4">
          <StatusMessage status={status} message={message} />
        </div>
      </SoftCard>

      {logoReferenceImages.length === 0 ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">등록된 로고 레퍼런스가 아직 없어요.</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">이미지를 등록하면 사용자 로고 제작 화면에서 선택할 수 있어요.</p>
        </SoftCard>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {logoReferenceImages.map((image) => (
            <LogoReferenceCard key={`${image.id}-${image.analysis?.forcedInstructions ?? ""}`} image={image} isDeleting={deletingLogoReferenceImageId === image.id} isUpdating={updatingLogoReferenceImageId === image.id} onDelete={onDeleteLogoReferenceImage} onUpdateForcedInstructions={onUpdateForcedInstructions} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogoReferenceCard({ image, isDeleting, isUpdating, onDelete, onUpdateForcedInstructions }: { image: LogoReferenceImage; isDeleting: boolean; isUpdating: boolean; onDelete: (image: LogoReferenceImage) => void; onUpdateForcedInstructions: (image: LogoReferenceImage, forcedInstructions: string) => void }) {
  const [forcedInstructions, setForcedInstructions] = useState(image.analysis?.forcedInstructions ?? "");
  const analysisStatusLabel = image.analysis?.status === "ready" ? "분석 완료" : image.analysis?.status === "skipped" ? "분석 건너뜀" : image.analysis?.status === "failed" ? "분석 실패" : "분석 없음";
  const sourceLabel = image.analysis?.source === "user" ? "사용자 업로드" : "관리자 등록";
  const isDirty = forcedInstructions.trim() !== (image.analysis?.forcedInstructions ?? "");
  const analysisSummary = readKoreanAnalysisText(image.analysis?.summary, "이전 분석 데이터가 영어라서 한국어 재분석이 필요해요.");
  const analysisStyleTags = image.analysis?.styleTags.filter(isKoreanAnalysisText) ?? [];
  const colorNotes = readKoreanAnalysisText(image.analysis?.colorNotes, "색감 정보는 한국어 재분석이 필요해요.");
  const compositionNotes = readKoreanAnalysisText(image.analysis?.compositionNotes, "구도 정보는 한국어 재분석이 필요해요.");
  const cautionNotes = readKoreanAnalysisText(image.analysis?.cautionNotes, "원본 로고, 문자, 캐릭터, 고유 표식은 복제하지 않고 분위기만 참고해야 해요.");

  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-[22px] border border-line bg-surface shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-floating">
      <div className="grid justify-center bg-surface-blue p-3">
        <Image className="block h-auto max-h-[360px] w-auto max-w-full rounded-[16px] object-contain shadow-soft" src={image.imageUrl} alt="" width={640} height={640} unoptimized />
      </div>
      <div className="grid min-w-0 gap-4 p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md bg-primary-soft px-3 py-1 text-[11px] font-black text-primary-strong">{analysisStatusLabel}</span>
          <span className="rounded-md bg-surface-blue px-3 py-1 text-[11px] font-black text-primary-strong">{sourceLabel}</span>
        </div>
        {image.analysis ? (
          <div className="grid gap-3 text-xs font-bold leading-5 text-muted">
            <p className="text-sm font-black leading-6 text-ink">{analysisSummary}</p>
            {analysisStyleTags.length > 0 ? <p className="text-primary-strong">{analysisStyleTags.map((tag) => `#${tag}`).join(" ")}</p> : null}
            <p><span className="font-black text-ink">색감</span> {colorNotes}</p>
            <p><span className="font-black text-ink">구도</span> {compositionNotes}</p>
            <p><span className="font-black text-ink">주의</span> {cautionNotes}</p>
          </div>
        ) : null}
        <label className="grid gap-2">
          <span className="text-xs font-black text-primary-strong">강제사항</span>
          <textarea className="min-h-24 resize-y rounded-md border border-line bg-surface-blue px-3 py-3 text-sm font-bold leading-6 text-ink outline-none transition focus:border-primary focus:bg-surface focus:shadow-soft" value={forcedInstructions} maxLength={500} placeholder="예: 캘리그라피 느낌의 휘갈겨쓴 서체" onChange={(event) => setForcedInstructions(event.target.value)} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="rounded-md bg-primary px-3 py-3 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" disabled={!isDirty || isUpdating} onClick={() => onUpdateForcedInstructions(image, forcedInstructions)}>
            {isUpdating ? "저장 중" : "강제사항 저장"}
          </button>
          <button className="rounded-md bg-danger px-3 py-3 text-xs font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" disabled={isDeleting} onClick={() => onDelete(image)}>
            {isDeleting ? "삭제 중" : "삭제"}
          </button>
        </div>
      </div>
    </article>
  );
}

function isKoreanAnalysisText(value: string | undefined) {
  return typeof value === "string" && /[가-힣]/.test(value) && !/[A-Za-z]{3,}/.test(value);
}

function readKoreanAnalysisText(value: string | undefined, fallback: string) {
  return isKoreanAnalysisText(value) ? value : fallback;
}

function BackgroundLibraryItem({ background, deletingBackgroundId, updatingBackgroundId, onUpdateBackground, onDeleteBackground }: { background: ManagedBusinessCardBackgroundWithUsage; deletingBackgroundId?: string; updatingBackgroundId?: string; onUpdateBackground: (background: ManagedBusinessCardBackgroundWithUsage, name: string, tagsText: string) => void; onDeleteBackground: (background: ManagedBusinessCardBackgroundWithUsage) => void }) {
  const [name, setName] = useState(background.name);
  const [tagsText, setTagsText] = useState(background.tags.join(", "));
  const isDirty = name.trim() !== background.name || tagsText.split(",").map((tag) => tag.trim()).filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index).join(", ") !== background.tags.join(", ");

  return (
    <article className="rounded-lg border border-line bg-surface p-3 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-primary-soft">
      <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-start">
        <div className="h-20 overflow-hidden rounded-md border border-line bg-surface-blue shadow-soft">
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(background.imageUrl)})` }} />
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-3 py-1 text-xs font-black ${background.used ? "bg-success text-white" : "bg-surface-blue text-primary-strong"}`}>{background.used ? `사용 중 ${background.usageCount}곳` : "사용 안 함"}</span>
            <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{Math.ceil(background.size / 1024)}KB</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <AdminTextField label="배경 이름" value={name} placeholder="배경 이름" maxLength={120} onChange={setName} />
            <AdminTextField label="태그" value={tagsText} placeholder="쉼표로 구분" onChange={setTagsText} />
          </div>
          <p className="truncate text-xs font-bold text-muted">{background.imageUrl}</p>
          <div className="flex flex-wrap gap-2">
            {background.tags.length > 0 ? background.tags.map((tag) => <span key={tag} className="rounded-sm bg-primary-soft px-2 py-1 text-xs font-black text-primary-strong">#{tag}</span>) : <span className="rounded-sm bg-surface-blue px-2 py-1 text-xs font-black text-soft">태그 없음</span>}
          </div>
        </div>
        <div className="grid gap-2">
          <button className="rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" onClick={() => onUpdateBackground(background, name, tagsText)} disabled={!isDirty || updatingBackgroundId === background.id}>
            {updatingBackgroundId === background.id ? "저장 중" : "정보 저장"}
          </button>
          <button className="rounded-md bg-danger px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="button" onClick={() => onDeleteBackground(background)} disabled={background.used || deletingBackgroundId === background.id}>
            {background.used ? "사용 중" : deletingBackgroundId === background.id ? "삭제 중" : "삭제"}
          </button>
        </div>
      </div>
    </article>
  );
}

function AdminTemplateThumbnail({ template }: { template: PrintTemplate }) {
  const orientation = getBusinessCardTemplateOrientation(template);
  const layout = layoutForOrientation(cloneBusinessCardTemplateLayout(template.layout ?? defaultBusinessCardTemplateLayout), orientation);

  return (
    <div className={`rounded-lg bg-surface-blue p-3 shadow-soft ${orientation === "vertical" ? "mx-auto w-36" : "w-full max-w-56"}`}>
      <BusinessCardTemplateRenderer brandName="프린티 스튜디오" category="브랜드 디자인" member={adminThumbnailMember} logo={adminThumbnailLogo} layout={layout} side="front" className="p-2 shadow-none" />
    </div>
  );
}

function prepressStatusMessage(response: PrepressCheckResponse) {
  if (response.status === "pdfx-validated") {
    return "PDF/X 검증기가 통과한 CMYK 프리프레스 PDF를 다운로드할 수 있어요.";
  }

  if (response.status === "pdfx-candidate") {
    return "CMYK PDF/X 후보를 만들 수 있지만, PDF/X 검증기는 아직 통과하지 않았거나 설정되지 않았어요.";
  }

  if (response.status === "validation-failed") {
    return "CMYK 변환은 시도됐지만 프리프레스 검증을 통과하지 못했어요.";
  }

  if (response.status === "prepress-unavailable") {
    return "서버에 Ghostscript/ICC/검증 도구 설정이 없어 PDF/X·CMYK 변환을 실행할 수 없어요.";
  }

  return "현재는 기존 인쇄소 전달 보조 PDF만 사용할 수 있어요.";
}

function TemplateEditorPanel({ form, selectedTemplate, managedBackgrounds, status, message, isSaving, onChange, onSubmit, onDelete }: { form: AdminFormState; selectedTemplate?: PrintTemplate; managedBackgrounds: ManagedBusinessCardBackgroundWithUsage[]; status: RequestStatus; message: string; isSaving: boolean; onChange: <K extends keyof AdminFormState>(field: K, value: AdminFormState[K]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete: () => void }) {
  const [exportStatus, setExportStatus] = useState<RequestStatus>("idle");
  const [exportMessage, setExportMessage] = useState("현재 입력된 레이아웃으로 유저 다운로드와 같은 서버 PDF를 확인할 수 있어요.");
  const [prepressStatus, setPrepressStatus] = useState<RequestStatus>("idle");
  const [prepressMessage, setPrepressMessage] = useState("저장된 템플릿에서 PDF/X·CMYK 변환 가능 여부를 확인할 수 있어요.");
  const [prepressCheck, setPrepressCheck] = useState<PrepressCheckResponse>();

  const handleOrientationChange = (value: string) => {
    const orientation = value === "vertical" ? "vertical" : "horizontal";

    onChange("orientation", orientation);
    onChange("layout", layoutForOrientation(form.layout, orientation));
  };

  const handleDraftPdfDownload = async () => {
    setExportStatus("loading");
    setExportMessage("현재 편집 중인 레이아웃으로 인쇄소 전달 PDF를 생성하고 있어요.");

    try {
      const payload = buildDraftPdfPayload(form);
      const response = await fetch("/api/admin/templates/print-shop-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => undefined);

        throw new Error(readApiErrorReason(data, "현재 레이아웃으로 PDF를 만들 수 없어요."));
      }

      const blob = await response.blob();

      downloadBlob(blob, safeDownloadFileName(payload.title));
      setExportStatus("success");
      setExportMessage("현재 편집 중인 레이아웃으로 인쇄소 전달 PDF를 다운로드했어요. 템플릿은 아직 저장되지 않았어요.");
    } catch (error) {
      setExportStatus("error");
      setExportMessage(error instanceof Error ? error.message : "현재 레이아웃 PDF 다운로드에 실패했어요.");
    }
  };

  const prepressPdfHref = selectedTemplate ? `/api/admin/templates/${encodeURIComponent(selectedTemplate.id)}/print-shop-pdf?variant=prepress` : undefined;

  const handlePrepressCheck = async () => {
    if (!selectedTemplate) {
      return;
    }

    setPrepressStatus("loading");
    setPrepressMessage("PDF/X·CMYK 변환 도구와 검증 상태를 확인하고 있어요.");

    try {
      const response = await fetch(`/api/admin/templates/${encodeURIComponent(selectedTemplate.id)}/print-shop-pdf?variant=prepress&check=1`, { credentials: "include", cache: "no-store" });
      const data = readPrepressCheckResponse(await response.json().catch(() => undefined));

      if (!data) {
        throw new Error("프리프레스 상태 응답이 올바르지 않아요.");
      }

      setPrepressCheck(data);
      setPrepressStatus(response.ok ? "success" : "error");
      setPrepressMessage(prepressStatusMessage(data));
    } catch (error) {
      setPrepressStatus("error");
      setPrepressMessage(error instanceof Error ? error.message : "프리프레스 상태를 확인하지 못했어요.");
    }
  };

  return (
    <SoftCard className="p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black text-primary-strong">구조화된 빌더</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">{selectedTemplate ? "템플릿 편집" : "새 템플릿 만들기"}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">서버 스키마에 맞는 필드만 입력해요. 공개 상태로 저장하면 앱의 공개 템플릿 API에 반영돼요.</p>
        </div>
        {selectedTemplate ? (
          <button className="rounded-md bg-danger px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onDelete} disabled={isSaving}>
            삭제
          </button>
        ) : null}
      </div>

      <div className="grid gap-6">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <AdminTextField label="제목" value={form.title} placeholder="예: 프리미엄 블루 명함" maxLength={80} onChange={(value) => onChange("title", value)} />
          <AdminTextArea label="요약" value={form.summary} placeholder="앱에서 고객에게 보일 템플릿 설명" maxLength={240} onChange={(value) => onChange("summary", value)} />
          <AdminTextField label="태그" value={form.tagsText} placeholder="쉼표로 구분: 가로, 프리미엄, 병원" onChange={(value) => onChange("tagsText", value)} />
          <div className="grid gap-4 md:grid-cols-2">
            <AdminSelect label="방향" value={form.orientation} onChange={handleOrientationChange} options={[{ value: "horizontal", label: "가로형" }, { value: "vertical", label: "세로형" }]} />
            <AdminSelect label="상태" value={form.status} onChange={(value) => onChange("status", value === "published" ? "published" : "draft")} options={businessCardTemplateStatuses.map((item) => ({ value: item, label: statusLabels[item] }))} />
          </div>
          <BusinessCardLayoutBuilder layout={form.layout} orientation={form.orientation} managedBackgrounds={managedBackgrounds} onChange={(layout) => onChange("layout", layout)} />
          <section className="rounded-lg border border-line bg-surface-blue p-4 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black text-primary-strong">PDF 확인</p>
                <p className="mt-1 text-sm font-bold leading-6 text-muted">현재 편집 중인 레이아웃을 유저 다운로드와 같은 서버 PDF 렌더러로 생성해요. PDF/X·CMYK 프리플라이트 인증은 포함하지 않아요.</p>
                <StatusMessage status={exportStatus} message={exportMessage} />
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <AppButton type="button" full={false} onClick={handleDraftPdfDownload} disabled={exportStatus === "loading"} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
                  {exportStatus === "loading" ? "PDF 생성 중" : "현재 레이아웃 PDF 다운로드"}
                </AppButton>
              </div>
            </div>
          </section>
          <section className="rounded-lg border border-line bg-surface p-4 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black text-primary-strong">PDF/X·CMYK 프리프레스</p>
                <p className="mt-1 text-sm font-bold leading-6 text-muted">서버에 Ghostscript와 검증 도구가 설정되어 있으면 CMYK PDF/X 후보를 생성하고, 검증기가 통과한 경우에만 PDF/X 검증 완료로 표시해요.</p>
                <p className="mt-2 text-xs font-black text-ink">{prepressMessage}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <AppButton type="button" variant="secondary" full={false} onClick={handlePrepressCheck} disabled={!selectedTemplate || prepressStatus === "loading"}>
                  {prepressStatus === "loading" ? "확인 중" : "프리프레스 상태 확인"}
                </AppButton>
                {prepressPdfHref && prepressCheck?.downloadable ? (
                  <a className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5" href={prepressPdfHref} download>
                    CMYK/PDF-X 후보 다운로드
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center rounded-md bg-surface-blue px-4 py-3 text-sm font-black text-soft shadow-soft">도구 확인 후 다운로드</span>
                )}
              </div>
            </div>
            {prepressCheck ? (
              <div className="mt-4 grid gap-2">
                {prepressCheck.checks.map((check) => (
                  <p key={check.name} className={`rounded-md border px-3 py-2 text-xs font-bold leading-5 ${check.status === "passed" ? "border-success bg-green-50 text-success" : check.status === "failed" ? "border-danger bg-red-50 text-danger" : "border-line bg-surface-blue text-muted"}`}>{check.name}: {check.message}</p>
                ))}
              </div>
            ) : null}
          </section>
          <StatusMessage status={status} message={message} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <AppButton type="submit" disabled={isSaving} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
              {selectedTemplate ? "변경사항 저장" : "템플릿 생성"}
            </AppButton>
          </div>
        </form>

      </div>
    </SoftCard>
  );
}

function AdminTextField({ label, value, placeholder, type = "text", maxLength, autoComplete, onChange }: { label: string; value: string; placeholder: string; type?: string; maxLength?: number; autoComplete?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <input className="w-full rounded-md border border-line bg-surface px-4 py-4 text-base font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" type={type} value={value} placeholder={placeholder} maxLength={maxLength} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminTextArea({ label, value, placeholder, maxLength, onChange }: { label: string; value: string; placeholder: string; maxLength?: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <textarea className="min-h-32 w-full resize-y rounded-md border border-line bg-surface px-4 py-4 text-base font-bold leading-7 text-ink outline-none transition focus:border-primary focus:shadow-soft" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AdminSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <select className="w-full rounded-md border border-line bg-surface px-4 py-4 text-base font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface px-3 py-4 shadow-soft">
      <p className="text-xs font-black text-soft">{label}</p>
      <p className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">{value}</p>
    </div>
  );
}

function StatusMessage({ status, message }: { status: RequestStatus; message: string }) {
  const statusClass = status === "error" ? "border-danger bg-red-50 text-danger" : status === "success" ? "border-success bg-green-50 text-success" : "border-line bg-surface-blue text-muted";

  return <p className={`rounded-md border px-4 py-3 text-sm font-bold leading-6 ${statusClass}`}>{message}</p>;
}
