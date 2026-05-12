import type { GeneratedLogoOption } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyDataPngUrl(value: string) {
  return value.startsWith("data:image/png;base64,") && value.length > "data:image/png;base64,".length;
}

function isGeneratedLogoPublicUrl(value: string) {
  if (!value.startsWith("/uploads/generated-logos/")) {
    return false;
  }

  const objectKey = value.slice("/uploads/generated-logos/".length);

  return /^[A-Za-z0-9_-]+\.png$/.test(objectKey) && !objectKey.includes("..");
}

function isGeneratedLogoImageUrl(value: unknown) {
  return typeof value === "string" && (isLegacyDataPngUrl(value) || isGeneratedLogoPublicUrl(value));
}

export function isGeneratedLogoOption(value: unknown): value is GeneratedLogoOption {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    isGeneratedLogoImageUrl(value.imageUrl) &&
    value.source === "openai"
  );
}
