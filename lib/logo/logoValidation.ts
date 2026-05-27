import type { GeneratedLogoOption } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLegacyDataPngUrl(value: string) {
  return value.startsWith("data:image/png;base64,") && value.length > "data:image/png;base64,".length;
}

function isGeneratedLogoPublicUrl(value: string) {
  const path = value.startsWith("/uploads/generated-logos/") ? value : publicUploadPathFromUrl(value);

  if (!path) {
    return false;
  }

  const objectKey = path.slice("/uploads/generated-logos/".length);

  return /^[A-Za-z0-9_-]+\.(png|svg)$/.test(objectKey) && !objectKey.includes("..");
}

function publicUploadPathFromUrl(value: string) {
  try {
    const url = new URL(value);

    return url.pathname.startsWith("/uploads/generated-logos/") ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}

function isHttpImageUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isGeneratedLogoImageUrl(value: unknown) {
  return typeof value === "string" && (isLegacyDataPngUrl(value) || isGeneratedLogoPublicUrl(value) || isHttpImageUrl(value));
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
    (value.vectorSvgUrl === undefined || (typeof value.vectorSvgUrl === "string" && isGeneratedLogoPublicUrl(value.vectorSvgUrl))) &&
    value.source === "openai"
  );
}
