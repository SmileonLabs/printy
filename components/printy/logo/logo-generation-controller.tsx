"use client";

import { useEffect } from "react";
import { getBrandGenerationKey, isLogoGenerationErrorPayload, isLogoGenerationJobCreateResponse, isLogoGenerationJobResponse } from "@/components/printy/logo/logo-generation";
import { findGeneratedLogoFromState, makeRevisionSourceLogo } from "@/components/printy/logo/logo-state";
import { isPlaceholderBrandName, readGeneratedLogoBrandContext } from "@/lib/logo/generatedLogoBrandContext";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

let activeLogoGenerationKey: string | undefined;

const GENERATION_JOB_POLL_INTERVAL_MS = 2000;
const GENERATION_JOB_TIMEOUT_MS = 10 * 60 * 1000;
const GENERATION_REQUEST_TIMEOUT_MS = GENERATION_JOB_TIMEOUT_MS + 10000;
const clientLogoGenerationFailureReason = "OpenAI 응답이 지연됐어요. 잠시 후 다시 시도해 주세요.";

function getRevisionBrandDraft() {
  const state = usePrintyStore.getState();
  const sourceLogoId = state.logoRevisionSourceLogoId;
  const sourceLogo = sourceLogoId ? findGeneratedLogoFromState(state, sourceLogoId) : undefined;
  const targetBrand = (state.logoGenerationTargetBrandId ? state.brands.find((brand) => brand.id === state.logoGenerationTargetBrandId) : undefined) ?? (sourceLogoId ? state.brands.find((brand) => brand.selectedLogoId === sourceLogoId || brand.logoIds?.includes(sourceLogoId)) : undefined);
  const logoContext = sourceLogo ? readGeneratedLogoBrandContext(sourceLogo) : {};

  if (targetBrand) {
    return {
      name: !isPlaceholderBrandName(targetBrand.name) ? targetBrand.name : logoContext.name ?? targetBrand.name,
      category: targetBrand.category.trim() ? targetBrand.category : logoContext.category ?? state.brandDraft.category,
      designRequest: targetBrand.designRequest.trim() ? targetBrand.designRequest : sourceLogo?.designRequest ?? state.brandDraft.designRequest,
    };
  }

  return {
    name: logoContext.name ?? state.brandDraft.name,
    category: logoContext.category ?? state.brandDraft.category,
    designRequest: sourceLogo?.designRequest ?? state.brandDraft.designRequest,
  };
}

class LogoGenerationRequestFailure extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Logo generation request failed.");
    this.name = "LogoGenerationRequestFailure";
    this.reason = reason;
  }
}

export function LogoGenerationController() {
  const currentStep = usePrintyStore((state) => state.currentStep);
  const brandDraft = usePrintyStore((state) => state.brandDraft);
  const logoGenerationMode = usePrintyStore((state) => state.logoGenerationMode);
  const selectedLogoReferenceImageId = usePrintyStore((state) => state.selectedLogoReferenceImageId);
  const logoGenerationIntent = usePrintyStore((state) => state.logoGenerationIntent);
  const logoRevisionRequest = usePrintyStore((state) => state.logoRevisionRequest);
  const logoRevisionSourceLogoId = usePrintyStore((state) => state.logoRevisionSourceLogoId);
  const setStep = usePrintyStore((state) => state.setStep);
  const startLogoGeneration = usePrintyStore((state) => state.startLogoGeneration);
  const setActiveLogoGenerationJob = usePrintyStore((state) => state.setActiveLogoGenerationJob);
  const finishLogoGeneration = usePrintyStore((state) => state.finishLogoGeneration);
  const failLogoGeneration = usePrintyStore((state) => state.failLogoGeneration);

  useEffect(() => {
    if (currentStep !== "generating" || logoGenerationIntent === "upload") {
      return;
    }

    const requestBrandDraft = logoGenerationIntent === "revision" ? getRevisionBrandDraft() : brandDraft;
    const generationKey = getBrandGenerationKey(requestBrandDraft, logoGenerationMode, logoGenerationIntent, logoRevisionRequest, logoRevisionSourceLogoId, selectedLogoReferenceImageId);
    const storedLogoGenerationJobId = usePrintyStore.getState().activeLogoGenerationJobId;

    if (activeLogoGenerationKey === generationKey) {
      return;
    }

    const revisionSourceLogo = logoGenerationIntent === "revision" && logoRevisionSourceLogoId ? findGeneratedLogoFromState(usePrintyStore.getState(), logoRevisionSourceLogoId) : undefined;

    if (logoGenerationIntent === "revision" && !revisionSourceLogo) {
      failLogoGeneration(`${logoUiCopy.missingSourceLogo.title}. ${logoUiCopy.missingSourceLogo.message}`);
      setStep("logoSelection");
      return;
    }

    activeLogoGenerationKey = generationKey;
    startLogoGeneration();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, GENERATION_REQUEST_TIMEOUT_MS);
    const startedAt = Date.now();

    const readErrorReason = async (response: Response) => {
      const payload: unknown = await response.json().catch(() => undefined);

      return isLogoGenerationErrorPayload(payload) ? payload.reason : clientLogoGenerationFailureReason;
    };

    const pollLogoGenerationJob = async (jobId: string) => {
      while (!controller.signal.aborted) {
        if (Date.now() - startedAt > GENERATION_JOB_TIMEOUT_MS) {
          throw new LogoGenerationRequestFailure(clientLogoGenerationFailureReason);
        }

        await new Promise<void>((resolve, reject) => {
          const pollTimeoutId = window.setTimeout(resolve, GENERATION_JOB_POLL_INTERVAL_MS);

          controller.signal.addEventListener(
            "abort",
            () => {
              window.clearTimeout(pollTimeoutId);
              reject(new DOMException("Logo generation was aborted.", "AbortError"));
            },
            { once: true },
          );
        });

        const response = await fetch(`/api/logos/generation-jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
          signal: controller.signal,
        }).catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
          }

          return undefined;
        });

        if (!response) {
          continue;
        }

        if (!response.ok) {
          if (response.status >= 500) {
            continue;
          }

          throw new LogoGenerationRequestFailure(await readErrorReason(response));
        }

        const payload: unknown = await response.json();

        if (!isLogoGenerationJobResponse(payload)) {
          throw new Error("Logo generation job response was invalid.");
        }

        if (payload.status === "succeeded") {
          return payload.result;
        }

        if (payload.status === "failed" || payload.status === "cancelled") {
          throw new LogoGenerationRequestFailure(payload.reason);
        }
      }

      throw new LogoGenerationRequestFailure(clientLogoGenerationFailureReason);
    };

    const generationPromise = storedLogoGenerationJobId
      ? pollLogoGenerationJob(storedLogoGenerationJobId)
      : fetch("/api/logos/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(
            logoGenerationIntent === "revision" && revisionSourceLogo
              ? {
                  mode: "revision",
                  brandName: requestBrandDraft.name,
                  industry: requestBrandDraft.category,
                  revisionRequest: logoRevisionRequest.trim(),
                  sourceLogo: makeRevisionSourceLogo(revisionSourceLogo),
                }
              : {
                  mode: "initial",
                  brandName: brandDraft.name,
                  industry: brandDraft.category,
                  designRequest: logoGenerationMode === "manual" || logoGenerationMode === "reference" ? brandDraft.designRequest : "",
                  generationMode: logoGenerationMode,
                  referenceImageId: logoGenerationMode === "reference" ? selectedLogoReferenceImageId : undefined,
                },
          ),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new LogoGenerationRequestFailure(await readErrorReason(response));
            }

            const payload: unknown = await response.json();

            if (!isLogoGenerationJobCreateResponse(payload)) {
              throw new Error("Logo generation job creation response was invalid.");
            }

            setActiveLogoGenerationJob(payload.jobId);

            return pollLogoGenerationJob(payload.jobId);
          });

    generationPromise
      .then((payload) => {
        const latestState = usePrintyStore.getState();
        const isActiveGenerationScreen = latestState.currentStep === "generating";
        const isBackgroundGeneration = Boolean(latestState.logoGenerationTargetBrandId && latestState.backgroundLogoGenerationNotice?.brandId === latestState.logoGenerationTargetBrandId && latestState.backgroundLogoGenerationNotice.status === "generating");

        const latestBrandDraft = latestState.logoGenerationIntent === "revision" ? getRevisionBrandDraft() : latestState.brandDraft;

        if ((!isActiveGenerationScreen && !isBackgroundGeneration) || getBrandGenerationKey(latestBrandDraft, latestState.logoGenerationMode, latestState.logoGenerationIntent, latestState.logoRevisionRequest, latestState.logoRevisionSourceLogoId, latestState.selectedLogoReferenceImageId) !== generationKey) {
          return;
        }

        const revisionSourceLogoId = latestState.logoRevisionSourceLogoId;
        const targetBrandId = latestState.logoGenerationTargetBrandId ?? (revisionSourceLogoId ? latestState.brands.find((brand) => brand.selectedLogoId === revisionSourceLogoId || brand.logoIds?.includes(revisionSourceLogoId))?.id : undefined);
        const isRevisionGeneration = latestState.logoGenerationIntent === "revision";

        finishLogoGeneration(payload.status, payload.logos, payload.reason);
        if (isActiveGenerationScreen && !targetBrandId) {
          setStep(isRevisionGeneration ? "logoSave" : "logoSelection");
        }
      })
      .catch((error: unknown) => {
        const latestState = usePrintyStore.getState();
        const isActiveGenerationScreen = latestState.currentStep === "generating";
        const isBackgroundGeneration = Boolean(latestState.logoGenerationTargetBrandId && latestState.backgroundLogoGenerationNotice?.brandId === latestState.logoGenerationTargetBrandId && latestState.backgroundLogoGenerationNotice.status === "generating");

        const latestBrandDraft = latestState.logoGenerationIntent === "revision" ? getRevisionBrandDraft() : latestState.brandDraft;

        if ((isActiveGenerationScreen || isBackgroundGeneration) && getBrandGenerationKey(latestBrandDraft, latestState.logoGenerationMode, latestState.logoGenerationIntent, latestState.logoRevisionRequest, latestState.logoRevisionSourceLogoId, latestState.selectedLogoReferenceImageId) === generationKey) {
          failLogoGeneration(error instanceof LogoGenerationRequestFailure ? error.reason : clientLogoGenerationFailureReason);
          if (isActiveGenerationScreen) {
            setStep("logoSelection");
          }
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);

        if (activeLogoGenerationKey === generationKey) {
          activeLogoGenerationKey = undefined;
        }
      });

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [brandDraft, currentStep, failLogoGeneration, finishLogoGeneration, logoGenerationIntent, logoGenerationMode, logoRevisionRequest, logoRevisionSourceLogoId, selectedLogoReferenceImageId, setActiveLogoGenerationJob, setStep, startLogoGeneration]);

  return null;
}
