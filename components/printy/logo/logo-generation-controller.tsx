"use client";

import { useEffect } from "react";
import { getBrandGenerationKey, isLogoGenerationErrorPayload, isLogoGenerationResponse } from "@/components/printy/logo/logo-generation";
import { findGeneratedLogoFromState, makeRevisionSourceLogo } from "@/components/printy/logo/logo-state";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import { usePrintyStore } from "@/store/use-printy-store";

let activeLogoGenerationKey: string | undefined;

const GENERATION_REQUEST_TIMEOUT_MS = 120000;
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
  const setStep = usePrintyStore((state) => state.setStep);
  const startLogoGeneration = usePrintyStore((state) => state.startLogoGeneration);
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

    fetch("/api/logos/generate", {
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
          const payload: unknown = await response.json().catch(() => undefined);
          const reason = isLogoGenerationErrorPayload(payload) ? payload.reason : clientLogoGenerationFailureReason;

          throw new LogoGenerationRequestFailure(reason);
        }

        const payload: unknown = await response.json();

        if (!isLogoGenerationResponse(payload)) {
          throw new Error("Logo generation response was invalid.");
        }

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
  }, [brandDraft, currentStep, failLogoGeneration, finishLogoGeneration, logoGenerationIntent, logoGenerationMode, logoRevisionRequest, logoRevisionSourceLogoId, selectedLogoReferenceImageId, setStep, startLogoGeneration]);

  return null;
}
