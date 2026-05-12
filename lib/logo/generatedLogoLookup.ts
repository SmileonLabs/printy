import type { GeneratedLogoOption } from "@/lib/types";

export type GeneratedLogoStateLike = {
  generatedLogoOptions: GeneratedLogoOption[];
  savedGeneratedLogoOptions: GeneratedLogoOption[];
};

export function findGeneratedLogoInState(state: GeneratedLogoStateLike, logoId: string): GeneratedLogoOption | undefined {
  return state.generatedLogoOptions.find((logo) => logo.id === logoId) ?? state.savedGeneratedLogoOptions.find((logo) => logo.id === logoId);
}
