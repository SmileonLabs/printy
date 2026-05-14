"use client";

import { useEffect } from "react";
import { getBrandGenerationKey, isLogoGenerationErrorPayload, isLogoGenerationJobCreateResponse, isLogoGenerationJobResponse } from "@/components/printy/logo/logo-generation";
import { findGeneratedLogoFromState, makeRevisionSourceLogo } from "@/components/printy/logo/logo-state";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

let activeLogoGenerationKey: string | undefined;

const GENERATION_JOB_POLL_INTERVAL_MS = 2000;
const GENERATION_JOB_TIMEOUT_MS = 10 * 60 * 1000;
const GENERATION_REQUEST_TIMEOUT_MS = GENERATION_JOB_TIMEOUT_MS + 10000;
const clientLogoGenerationFailureReason = "OpenAI 응답이 지연됐어요. 잠시 후 다시 시도해 주세요.";

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
  const activeLogoGenerationJobId = usePrintyStore((state) => state.activeLogoGenerationJobId);
  const setStep = usePrintyStore((state) => state.setStep);
  const startLogoGeneration = usePrintyStore((state) => state.startLogoGeneration);
  const setActiveLogoGenerationJob = usePrintyStore((state) => state.setActiveLogoGenerationJob);
  const beginBackgroundLogoGeneration = usePrintyStore((state) => state.beginBackgroundLogoGeneration);
  const finishLogoGeneration = usePrintyStore((state) => state.finishLogoGeneration);
  const failLogoGeneration = usePrintyStore((state) => state.failLogoGeneration);

  useEffect(() => {
    if (currentStep !== "generating") {
      return;
    }

    const generationKey = getBrandGenerationKey(brandDraft, logoGenerationMode, logoGenerationIntent, logoRevisionRequest, logoRevisionSourceLogoId, selectedLogoReferenceImageId);

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

    const generationPromise = activeLogoGenerationJobId
      ? pollLogoGenerationJob(activeLogoGenerationJobId)
      : fetch("/api/logos/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(
            logoGenerationIntent === "revision" && revisionSourceLogo
              ? {
                  mode: "revision",
                  brandName: brandDraft.name,
                  industry: brandDraft.category,
                  revisionRequest: logoRevisionRequest,
                  sourceLogo: makeRevisionSourceLogo(revisionSourceLogo),
                }
              : {
                  mode: "initial",
                  brandName: brandDraft.name,
                  industry: brandDraft.category,
                  designRequest: logoGenerationMode === "manual" ? brandDraft.designRequest : "",
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

            const targetBrandId = usePrintyStore.getState().logoGenerationTargetBrandId;

            if (targetBrandId) {
              beginBackgroundLogoGeneration(targetBrandId);
            }

            return pollLogoGenerationJob(payload.jobId);
          });

    generationPromise
      .then((payload) => {
        const latestState = usePrintyStore.getState();

        if (latestState.currentStep !== "generating" || getBrandGenerationKey(latestState.brandDraft, latestState.logoGenerationMode, latestState.logoGenerationIntent, latestState.logoRevisionRequest, latestState.logoRevisionSourceLogoId, latestState.selectedLogoReferenceImageId) !== generationKey) {
          return;
        }

        finishLogoGeneration(payload.status, payload.logos, payload.reason);
        setStep("logoSelection");
      })
      .catch((error: unknown) => {
        const latestState = usePrintyStore.getState();

        if (latestState.currentStep === "generating" && getBrandGenerationKey(latestState.brandDraft, latestState.logoGenerationMode, latestState.logoGenerationIntent, latestState.logoRevisionRequest, latestState.logoRevisionSourceLogoId, latestState.selectedLogoReferenceImageId) === generationKey) {
          failLogoGeneration(error instanceof LogoGenerationRequestFailure ? error.reason : clientLogoGenerationFailureReason);
          setStep("logoSelection");
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
  }, [activeLogoGenerationJobId, beginBackgroundLogoGeneration, brandDraft, currentStep, failLogoGeneration, finishLogoGeneration, logoGenerationIntent, logoGenerationMode, logoRevisionRequest, logoRevisionSourceLogoId, selectedLogoReferenceImageId, setActiveLogoGenerationJob, setStep, startLogoGeneration]);

  return null;
}
