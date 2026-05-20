"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import type { GeneratedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

const cropOutputSize = 1024;
const cropHandleSize = 18;

type DragState = {
  pointerId: number;
  mode: CropDragMode;
  startX: number;
  startY: number;
  startRect: CropRect;
};

type CropDragMode = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageSize = {
  width: number;
  height: number;
};

function readUploadResponse(value: unknown): GeneratedLogoOption | undefined {
  if (typeof value !== "object" || value === null || !("logo" in value)) {
    return undefined;
  }

  return isGeneratedLogoOption(value.logo) ? value.logo : undefined;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Canvas export failed."));
    }, "image/png");
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getDefaultCropRect(imageSize?: ImageSize): CropRect {
  if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) {
    return { x: 10, y: 10, width: 80, height: 80 };
  }

  const aspectRatio = imageSize.width / imageSize.height;

  if (aspectRatio >= 1) {
    const height = 100 / aspectRatio;

    return { x: 0, y: (100 - height) / 2, width: 100, height };
  }

  const width = aspectRatio * 100;

  return { x: (100 - width) / 2, y: 0, width, height: 100 };
}

function getImageRect(imageSize: ImageSize): CropRect {
  return getDefaultCropRect(imageSize);
}

function normalizeCropRect(rect: CropRect, minSize = 10): CropRect {
  const width = clamp(rect.width, minSize, 100);
  const height = clamp(rect.height, minSize, 100);
  const x = clamp(rect.x, 0, 100 - width);
  const y = clamp(rect.y, 0, 100 - height);

  return { x, y, width, height };
}

function resizeCropRect(startRect: CropRect, mode: CropDragMode, deltaX: number, deltaY: number): CropRect {
  let { x, y, width, height } = startRect;

  if (mode === "move") {
    return normalizeCropRect({ ...startRect, x: startRect.x + deltaX, y: startRect.y + deltaY });
  }

  if (mode.includes("w")) {
    x = startRect.x + deltaX;
    width = startRect.width - deltaX;
  }

  if (mode.includes("e")) {
    width = startRect.width + deltaX;
  }

  if (mode.includes("n")) {
    y = startRect.y + deltaY;
    height = startRect.height - deltaY;
  }

  if (mode.includes("s")) {
    height = startRect.height + deltaY;
  }

  return normalizeCropRect({ x, y, width, height });
}

function intersectCropRect(cropRect: CropRect, imageRect: CropRect): CropRect {
  const left = Math.max(cropRect.x, imageRect.x);
  const top = Math.max(cropRect.y, imageRect.y);
  const right = Math.min(cropRect.x + cropRect.width, imageRect.x + imageRect.width);
  const bottom = Math.min(cropRect.y + cropRect.height, imageRect.y + imageRect.height);

  if (right <= left || bottom <= top) {
    return imageRect;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

async function createCroppedLogoFile(file: File, previewUrl: string, cropRect: CropRect, imageSize: ImageSize) {
  const image = await loadImage(previewUrl);
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const imageRect = getImageRect(imageSize);
  const clippedCropRect = intersectCropRect(cropRect, imageRect);
  const sourceX = ((clippedCropRect.x - imageRect.x) / imageRect.width) * naturalWidth;
  const sourceY = ((clippedCropRect.y - imageRect.y) / imageRect.height) * naturalHeight;
  const sourceWidth = (clippedCropRect.width / imageRect.width) * naturalWidth;
  const sourceHeight = (clippedCropRect.height / imageRect.height) * naturalHeight;
  const cropAspectRatio = sourceWidth / sourceHeight;
  const outputWidth = cropAspectRatio >= 1 ? cropOutputSize : Math.max(1, Math.round(cropOutputSize * cropAspectRatio));
  const outputHeight = cropAspectRatio >= 1 ? Math.max(1, Math.round(cropOutputSize / cropAspectRatio)) : cropOutputSize;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is unavailable.");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.fillStyle = "white";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

  const blob = await canvasToBlob(canvas);

  return new File([blob], file.name.replace(/\.[^.]+$/, "") || "cropped-logo.png", { type: "image/png" });
}

export function LogoUploadScreen() {
  const { brandDraft, logoGenerationTargetBrandId, failLogoGeneration, registerUploadedLogo, setStep, startUploadedLogoRegistration } = usePrintyStore();
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize>();
  const [cropRect, setCropRect] = useState<CropRect>(() => getDefaultCropRect());
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    loadImage(objectUrl).then((image) => {
      const nextImageSize = { width: image.naturalWidth, height: image.naturalHeight };

      setImageSize(nextImageSize);
      setCropRect(getDefaultCropRect(nextImageSize));
    }).catch(() => undefined);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleFileChange = (nextFile?: File) => {
    setFile(nextFile);
    setStatus("");
    setImageSize(undefined);
    setCropRect(getDefaultCropRect());
  };

  const handleCropPointerDown = (event: PointerEvent<HTMLElement>, mode: CropDragMode) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRect: cropRect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    const cropFrame = cropFrameRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !cropFrame) {
      return;
    }

    const frameRect = cropFrame.getBoundingClientRect();
    const deltaX = ((event.clientX - dragState.startX) / frameRect.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / frameRect.height) * 100;

    setCropRect(resizeCropRect(dragState.startRect, dragState.mode, deltaX, deltaY));
  };

  const handleCropPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = undefined;
    }
  };

  const handleUpload = async () => {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setStatus("크롭한 이미지를 준비하고 있어요.");

    const formData = new FormData();
    formData.set("brandName", brandDraft.name);
    formData.set("category", brandDraft.category);

    try {
      startUploadedLogoRegistration();
      const uploadFile = previewUrl && imageSize ? await createCroppedLogoFile(file, previewUrl, cropRect, imageSize) : file;

      formData.set("file", uploadFile);

      const response = await fetch("/api/logos/upload", { method: "POST", body: formData });
      const body = await response.json().catch(() => undefined);
      const logo = readUploadResponse(body);

      if (!response.ok || !logo) {
        const reason = typeof body === "object" && body !== null && "reason" in body && typeof body.reason === "string" ? body.reason : "로고 등록에 실패했어요.";
        failLogoGeneration(reason);
        setStep("logoUpload");
        setStatus(reason);
        return;
      }

      registerUploadedLogo(logo);
    } catch {
      const reason = "네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.";
      failLogoGeneration(reason);
      setStep("logoUpload");
      setStatus(reason);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Screen footer={<AppButton onClick={handleUpload} disabled={!file || isUploading} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">{isUploading ? "정리 중..." : "가지고 있는 로고 등록"}</AppButton>}>
      <ProgressHeader eyebrow={logoGenerationTargetBrandId ? "로고 등록" : "내 로고"} title="가지고 있는 로고를 등록해요" description="이미지를 올리면 Printy가 AI 이미지 모델로 형태를 최대한 보존해 인쇄와 목업에 쓰기 좋은 PNG 로고로 정리해요." step={stepNumbers.logoUpload} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <div className="grid gap-5">
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <label className="grid cursor-pointer place-items-center gap-3 rounded-lg border-2 border-dashed border-primary-soft bg-white/70 px-4 py-8 text-center transition hover:bg-white">
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFileChange(event.target.files?.[0])} />
            <span className="text-sm font-black text-primary-strong">PNG, JPG, WEBP 업로드</span>
            <span className="text-xs font-bold leading-5 text-muted">최대 8MB까지 가능해요. 세부 형태나 글자는 AI 정리 과정에서 조금 달라질 수 있어요.</span>
          </label>
        </SoftCard>
        {previewUrl ? (
          <SoftCard>
            <p className="mb-3 text-sm font-black text-ink">크롭 영역 조정</p>
            <div ref={cropFrameRef} className="relative aspect-square touch-none overflow-hidden rounded-lg bg-surface-blue ring-4 ring-white" onPointerMove={handleCropPointerMove} onPointerUp={handleCropPointerEnd} onPointerCancel={handleCropPointerEnd}>
              <Image src={previewUrl} alt="선택한 로고 이미지" fill sizes="(max-width: 430px) 100vw, 390px" className="object-contain" unoptimized />
              <div className="pointer-events-none absolute inset-0 bg-black/25" />
              <div
                className="absolute cursor-move border-2 border-white bg-white/5 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]"
                style={{ left: `${cropRect.x}%`, top: `${cropRect.y}%`, width: `${cropRect.width}%`, height: `${cropRect.height}%` }}
                onPointerDown={(event) => handleCropPointerDown(event, "move")}
              >
                <span className="absolute left-1 top-1 rounded bg-white/95 px-2 py-1 text-[10px] font-black text-primary-strong shadow-card">드래그해서 이동</span>
                {[
                  ["nw", "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize"],
                  ["ne", "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize"],
                  ["sw", "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize"],
                  ["se", "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize"],
                  ["n", "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize"],
                  ["s", "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize"],
                  ["w", "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
                  ["e", "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize"],
                ].map(([mode, className]) => (
                  <button
                    key={mode}
                    className={`absolute rounded-full border-2 border-white bg-primary shadow-card ${className}`}
                    style={{ width: cropHandleSize, height: cropHandleSize }}
                    type="button"
                    aria-label="크롭 영역 크기 조정"
                    onPointerDown={(event) => handleCropPointerDown(event, mode as CropDragMode)}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <p className="text-xs font-bold leading-5 text-muted">사각형 안을 드래그하면 위치가 이동하고, 파란 점을 잡아 크기를 자유롭게 조정할 수 있어요. 선택 영역만 AI가 Printy 로고 저장 형식에 맞게 다시 정리해요.</p>
            </div>
          </SoftCard>
        ) : null}
        {status ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{status}</SoftCard> : null}
      </div>
    </Screen>
  );
}
