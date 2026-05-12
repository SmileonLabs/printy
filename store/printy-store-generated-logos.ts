import type { GeneratedLogoOption } from "@/lib/types";

export function saveGeneratedLogo(savedLogos: GeneratedLogoOption[], logo: GeneratedLogoOption) {
  return [logo, ...savedLogos.filter((savedLogo) => savedLogo.id !== logo.id)];
}
