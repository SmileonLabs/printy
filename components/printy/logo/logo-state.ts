import { getLogo } from "@/components/ui/logo";
import { findGeneratedLogoInState, type GeneratedLogoStateLike } from "@/lib/logo/generatedLogoLookup";
import type { GeneratedLogoOption, LogoRevisionSourceLogo, ResolvedLogoOption } from "@/lib/types";

export function resolveLogoFromState(state: GeneratedLogoStateLike, logoId: string): ResolvedLogoOption {
  return getLogo(logoId, [...state.generatedLogoOptions, ...state.savedGeneratedLogoOptions]);
}

export function findGeneratedLogoFromState(state: GeneratedLogoStateLike, logoId: string): GeneratedLogoOption | undefined {
  return findGeneratedLogoInState(state, logoId);
}

export function makeRevisionSourceLogo(logo: GeneratedLogoOption): LogoRevisionSourceLogo {
  return {
    id: logo.id,
    imageUrl: logo.imageUrl,
    label: logo.label,
    description: logo.description,
    promptSummary: logo.promptSummary,
    lens: logo.lens,
    designRequest: logo.designRequest,
    requestSummary: logo.requestSummary,
  };
}
