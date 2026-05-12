"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { DesignRequestField } from "@/components/printy/onboarding/design-request-field";
import { GenerationModeSelector } from "@/components/printy/onboarding/selectors";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import type { LogoReferenceImage } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";
import { HomeExitAction } from "./home-exit-action";

type LogoReferenceImagesResponse = {
  images: LogoReferenceImage[];
};

type LogoReferenceImageUploadResponse = {
  image: LogoReferenceImage;
};

function isLogoReferenceImagesResponse(value: unknown): value is LogoReferenceImagesResponse {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { images?: unknown }).images)) {
    return false;
  }

  return (value as { images: unknown[] }).images.every((image) => typeof image === "object" && image !== null && typeof (image as { id?: unknown }).id === "string" && typeof (image as { imageUrl?: unknown }).imageUrl === "string");
}

function isLogoReferenceImageUploadResponse(value: unknown): value is LogoReferenceImageUploadResponse {
  return typeof value === "object" && value !== null && typeof (value as { image?: { id?: unknown; imageUrl?: unknown } }).image?.id === "string" && typeof (value as { image?: { id?: unknown; imageUrl?: unknown } }).image?.imageUrl === "string";
}

function readApiErrorReason(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && typeof (value as { reason?: unknown }).reason === "string" ? (value as { reason: string }).reason : fallback;
}

export function LogoDirectionScreen() {
  const { brandDraft, logoGenerationMode, selectedLogoReferenceImageId, updateBrandDraft, setLogoGenerationMode, selectLogoReferenceImage, cancelLogoRevision, setStep } = usePrintyStore();
  const [referenceImages, setReferenceImages] = useState<LogoReferenceImage[]>([]);
  const [referenceFile, setReferenceFile] = useState<File>();
  const [referenceFileInputKey, setReferenceFileInputKey] = useState(0);
  const [referenceUploadMessage, setReferenceUploadMessage] = useState("");
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const canGenerate = brandDraft.name.trim().length > 0 && brandDraft.category.trim().length > 0 && (logoGenerationMode !== "reference" || Boolean(selectedLogoReferenceImageId));
  const showManualFields = logoGenerationMode === "manual";
  const showReferenceFields = logoGenerationMode === "reference";

  useEffect(() => {
    fetch("/api/logo-reference-images", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((payload: unknown) => {
        if (isLogoReferenceImagesResponse(payload)) {
          setReferenceImages(payload.images);

          if (!selectedLogoReferenceImageId && payload.images[0]) {
            selectLogoReferenceImage(payload.images[0].id);
          }
        }
      })
      .catch(() => undefined);
  }, [selectLogoReferenceImage, selectedLogoReferenceImageId]);

  const handleGenerate = () => {
    cancelLogoRevision();
    setStep("generating");
  };

  const handleReferenceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setReferenceFile(event.target.files?.[0]);
    setReferenceUploadMessage("");
  };

  const handleUploadReferenceImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!referenceFile) {
      setReferenceUploadMessage("업로드할 참고 이미지를 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", referenceFile);
    setIsUploadingReference(true);
    setReferenceUploadMessage("참고 이미지를 등록하고 있어요.");

    try {
      const response = await fetch("/api/logo-reference-images", { method: "POST", body: formData });
      const data: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(readApiErrorReason(data, "참고 이미지를 등록하지 못했어요."));
      }

      if (!isLogoReferenceImageUploadResponse(data)) {
        throw new Error("참고 이미지 등록 응답이 올바르지 않아요.");
      }

      setReferenceImages((current) => [data.image, ...current.filter((image) => image.id !== data.image.id)]);
      selectLogoReferenceImage(data.image.id);
      setReferenceFile(undefined);
      setReferenceFileInputKey((current) => current + 1);
      setReferenceUploadMessage("참고 이미지를 등록했어요. 이 이미지로 새 로고를 만들 수 있어요.");
    } catch (error) {
      setReferenceUploadMessage(error instanceof Error ? error.message : "참고 이미지를 등록하지 못했어요.");
    } finally {
      setIsUploadingReference(false);
    }
  };

  return (
    <Screen footer={<AppButton onClick={handleGenerate} disabled={!canGenerate} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">로고 만들기</AppButton>}>
      <ProgressHeader eyebrow="디자인 요청" title="친구에게 말하듯 자유롭게 적기" description={`${brandDraft.name}의 이름과 ${brandDraft.category} 업종은 고정하고, 원하는 로고를 자연스러운 문장으로 알려주세요. 비워두면 Printy가 업종 기반 요청을 직접 씁니다.`} step={stepNumbers.logoDirection} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <div className="grid gap-5">
        <GenerationModeSelector selected={logoGenerationMode} onSelect={setLogoGenerationMode} />
        {showManualFields ? (
          <DesignRequestField value={brandDraft.designRequest} onChange={(value) => updateBrandDraft("designRequest", value)} />
        ) : showReferenceFields ? (
          <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
            <p className="text-xs font-black text-primary-strong">참고 이미지 선택</p>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">참고 이미지는 그대로 복사하지 않고 색감, 분위기, 구도만 참고해서 새 로고를 만들어요.</p>
            <form className="mt-4 grid gap-3 rounded-lg border border-dashed border-primary-soft bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={handleUploadReferenceImage}>
              <label className="block">
                <span className="mb-2 block text-xs font-black text-primary-strong">내 참고 이미지 업로드</span>
                <input key={referenceFileInputKey} className="block w-full text-xs font-bold text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-black file:text-white disabled:cursor-not-allowed disabled:opacity-60" type="file" accept="image/png,image/jpeg" disabled={isUploadingReference} onChange={handleReferenceFileChange} />
                <span className="mt-2 block text-xs font-bold leading-5 text-muted">PNG/JPG, 5MB 이하. 업로드하면 관리자 레퍼런스 목록에도 함께 저장돼요.</span>
              </label>
              <button className="rounded-md bg-primary px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" type="submit" disabled={isUploadingReference || !referenceFile}>
                {isUploadingReference ? "등록 중" : "업로드"}
              </button>
              {referenceUploadMessage ? <p className="text-xs font-bold text-muted sm:col-span-2">{referenceUploadMessage}</p> : null}
            </form>
            <div className="mt-4 grid gap-3">
              {referenceImages.length === 0 ? <p className="rounded-md border border-line bg-surface px-4 py-3 text-xs font-bold text-muted">관리자가 등록한 참고 이미지가 아직 없어요.</p> : null}
              {referenceImages.map((image) => (
                <button key={image.id} className={`grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-md border p-2 text-left transition ${selectedLogoReferenceImageId === image.id ? "border-primary bg-surface shadow-soft ring-4 ring-primary-soft" : "border-line bg-surface hover:border-primary-soft"}`} type="button" onClick={() => selectLogoReferenceImage(image.id)}>
                  <span className="h-16 w-16 overflow-hidden rounded-sm border border-line bg-surface-blue">
                    <Image className="h-full w-full object-cover" src={image.imageUrl} alt="" width={72} height={72} unoptimized />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-ink">{image.name}</span>
                    <span className="mt-1 block text-xs font-bold text-muted">{Math.ceil(image.size / 1024)}KB</span>
                  </span>
                  <span className={`h-2.5 w-2.5 rounded-full ${selectedLogoReferenceImageId === image.id ? "bg-primary" : "bg-soft"}`} />
                </button>
              ))}
            </div>
          </SoftCard>
        ) : (
          <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
            <p className="text-xs font-black text-primary-strong">자동 요청 작성</p>
            <p className="mt-2 text-sm font-bold leading-6 text-muted">자유 요청을 비워둬도 괜찮아요. Printy가 브랜드명과 업종을 바탕으로 요청을 내부에서 작성해 AI에게 전달해요.</p>
          </SoftCard>
        )}
      </div>
    </Screen>
  );
}
