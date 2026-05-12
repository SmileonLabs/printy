import type { GeneratedLogoOption, LogoGenerationIntent, LogoGenerationMode, LogoGenerationResponse } from "@/lib/types";
import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";

type BrandGenerationDraft = {
  name: string;
  category: string;
  designRequest: string;
};

export function getBrandGenerationKey(brandDraft: BrandGenerationDraft, generationMode: LogoGenerationMode, generationIntent: LogoGenerationIntent, revisionRequest: string, revisionSourceLogoId?: string, referenceImageId?: string): string {
  const requestKey = generationIntent === "revision" ? revisionRequest.trim() : generationMode === "manual" ? brandDraft.designRequest.trim() : "";
  const modeKey = generationIntent === "revision" ? generationIntent : generationMode;
  const sourceKey = generationIntent === "revision" ? revisionSourceLogoId ?? "" : generationMode === "reference" ? referenceImageId ?? "" : "";

  return [brandDraft.name.trim(), brandDraft.category.trim(), requestKey, modeKey, sourceKey].join("|");
}

export function isLogoGenerationResponse(value: unknown): value is LogoGenerationResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (record.status !== "success" || !Array.isArray(record.logos)) {
    return false;
  }

  return record.logos.every(isGeneratedLogoOption) && (record.reason === undefined || typeof record.reason === "string");
}

export function isLogoGenerationErrorPayload(value: unknown): value is { reason: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.reason === "string" && record.reason.trim().length > 0;
}
