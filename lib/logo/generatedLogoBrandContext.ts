import type { GeneratedLogoOption } from "@/lib/types";

export type GeneratedLogoBrandContext = {
  name?: string;
  category?: string;
};

function cleanMatch(value: string | undefined) {
  const cleaned = value?.trim();

  return cleaned && cleaned.length <= 100 ? cleaned : undefined;
}

function readContextFromText(value: string | undefined): GeneratedLogoBrandContext {
  if (!value) {
    return {};
  }

  const initialMatch = value.match(/입력 해석:\s*(.+?)의\s+(.+?)\s+로고를/);

  if (initialMatch) {
    return {
      name: cleanMatch(initialMatch[1]),
      category: cleanMatch(initialMatch[2]),
    };
  }

  const revisionMatch = value.match(/수정 요청:\s*(.+?)의\s+선택 로고를/);

  if (revisionMatch) {
    return {
      name: cleanMatch(revisionMatch[1]),
    };
  }

  return {};
}

export function isPlaceholderBrandName(value: string) {
  return /^새\s*브랜드$/.test(value.trim());
}

export function readGeneratedLogoBrandContext(logo: GeneratedLogoOption): GeneratedLogoBrandContext {
  const promptContext = readContextFromText(logo.promptSummary);

  return promptContext.name || promptContext.category ? promptContext : readContextFromText(logo.description);
}
