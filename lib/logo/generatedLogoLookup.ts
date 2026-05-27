import type { GeneratedLogoOption } from "@/lib/types";

export type GeneratedLogoStateLike = {
  generatedLogoOptions: GeneratedLogoOption[];
  savedGeneratedLogoOptions: GeneratedLogoOption[];
};

export function findGeneratedLogoInState(state: GeneratedLogoStateLike, logoId: string): GeneratedLogoOption | undefined {
  const generatedLogo = state.generatedLogoOptions.find((logo) => logo.id === logoId);
  const savedLogo = state.savedGeneratedLogoOptions.find((logo) => logo.id === logoId);

  if (generatedLogo && savedLogo?.vectorSvgUrl && !generatedLogo.vectorSvgUrl) {
    return { ...generatedLogo, vectorSvgUrl: savedLogo.vectorSvgUrl };
  }

  return generatedLogo ?? savedLogo;
}
