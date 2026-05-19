import type { LogoGenerationInput, LogoRevisionGenerationInput, LogoVariationDraft } from "@/lib/types";
import type { IndustryStyleProfile } from "@/lib/logo/industryStyleMapper";

export const hiddenQualityPrompt = "Professional logo design, award-winning branding style, strong concept, well-balanced layout, clean vector style, modern identity design, high-end branding, creative typography, unique symbol integration, minimal but distinctive, precise spacing, harmonious composition.";

export const logoAvoidRules = [
  "no mockup",
  "no photo",
  "no realistic scene",
  "no packaging render",
  "no people",
  "no watermark",
  "no stock icon look",
  "no busy background",
  "no extra words beyond the brand name",
  "no misspelled lettering",
  "no tiny unreadable details",
];

function exactBrandNameRule(brandName: string) {
  return `Visible brand text rule: if the logo contains text, the text must be exactly "${brandName}". Do not translate, abbreviate, rename, or invent different lettering. Avoid all placeholder or generic lettering.`;
}

function revisionTextRule(brandName: string) {
  return `Visible text rule: preserve the source logo text by default. If the user explicitly asks to change, remove, replace, or rewrite text, follow that text-edit request exactly. Do not add generic placeholder lettering. Brand context: "${brandName}".`;
}

const symbolOnlyTextKeepTerms = ["글자는", "글자", "텍스트", "워드마크", "브랜드명", "이름"];
const symbolOnlyKeepTerms = ["두고", "그대로", "유지", "건드리지", "바꾸지"];
const symbolOnlyTargetTerms = ["심볼", "아이콘", "마크", "상징"];
const symbolOnlyChangeTerms = ["변경", "바꿔", "교체", "새롭게", "다르게"];
const symbolOnlyEnglishPhrases = ["keep text", "keep wordmark", "change only symbol", "change only icon", "replace mark"];

export function isSymbolOnlyRevisionRequest(revisionRequest: string) {
  const normalizedRequest = revisionRequest.toLowerCase();

  if (symbolOnlyEnglishPhrases.some((phrase) => normalizedRequest.includes(phrase))) {
    return true;
  }

  const hasTextKeepCue = symbolOnlyTextKeepTerms.some((term) => normalizedRequest.includes(term));
  const hasKeepCue = symbolOnlyKeepTerms.some((term) => normalizedRequest.includes(term));
  const hasTargetCue = symbolOnlyTargetTerms.some((term) => normalizedRequest.includes(term));
  const hasChangeCue = symbolOnlyChangeTerms.some((term) => normalizedRequest.includes(term));

  return hasTargetCue && hasChangeCue && hasTextKeepCue && hasKeepCue;
}

export function buildLogoPrompt(input: LogoGenerationInput, variation: LogoVariationDraft, styleProfile: IndustryStyleProfile) {
  const userRequest = input.designRequest.trim() || "No user-written request was provided. Create a thoughtful interpretation from the brand name and industry.";

  return [
    `Create a professional logo for brand name "${input.brandName}".`,
    exactBrandNameRule(input.brandName),
    `Industry: ${input.industry}. Interpreted category: ${styleProfile.category}.`,
    `User design request: ${userRequest}`,
    `Interpretation lens: ${variation.lens ?? variation.label}.`,
    `Lens request summary: ${variation.requestSummary ?? variation.designRequest ?? userRequest}.`,
    `Respect the user's wants exactly when they mention colors, symbols, typography, style, mood, audience, or composition. Respect the user's avoid/exclude/without/no requests and do not add those elements back through the lens.`,
    `Layout: ${variation.layout}.`,
    `Typography: ${variation.typography}.`,
    `Color palette: ${variation.colorPalette}.`,
    `Concept: ${variation.concept}. Connect the mark to these business cues: ${styleProfile.visualCues.join(", ")}. Suggested symbolic language: ${styleProfile.symbols.join(", ")}.`,
    `Complexity: ${variation.complexity}. Keep it scalable, vector-like, balanced, and readable at business-card size.`,
    `Output: centered logo, strong silhouette, clean edges, print-ready composition, readable on business cards and small printed materials.`,
    `Avoid: ${logoAvoidRules.join(", ")}.`,
    hiddenQualityPrompt,
  ].join(" ");
}

export function buildReferenceLogoPrompt(input: LogoGenerationInput, variation: LogoVariationDraft) {
  const userRequest = input.designRequest.trim();

  return [
    `Create a new original logo for brand name "${input.brandName}" using the attached reference image as the dominant visual direction.`,
    exactBrandNameRule(input.brandName),
    `Industry context only: ${input.industry}. Do not let industry defaults override the reference image style.`,
    userRequest ? `One-time user requirements for this generation: ${userRequest}` : "No extra one-time user requirements were provided; follow the reference image style closely.",
    `Reference priority contract: the reference image must dominate style, composition, color mood, line quality, texture impression, visual density, ornament level, and typography mood.`,
    `Do not normalize the result into Printy's default modern, minimal, clean-vector, premium-branding, or generic industry-symbol style when the reference image shows a different visual language.`,
    `Only adapt broad style, form language, color mood, and composition principles. Do not copy protected logos, exact marks, characters, exact text, or distinctive artwork from the reference image.`,
    `Brand text rule: if text appears, use only the exact brand name "${input.brandName}" and keep it readable, but match the reference image's lettering mood rather than a generic font style.`,
    `Output: centered standalone logo suitable for print and business-card use, while preserving the reference-led visual character.`,
    `Avoid: ${logoAvoidRules.join(", ")}.`,
  ].join(" ");
}

export function buildLogoRevisionPrompt(input: LogoRevisionGenerationInput, variation: LogoVariationDraft, styleProfile: IndustryStyleProfile) {
  const symbolOnlyRevision = isSymbolOnlyRevisionRequest(input.revisionRequest);
  const sourceDetails = [
    input.sourceLogo.label ? `label: ${input.sourceLogo.label}` : "",
    input.sourceLogo.description ? `description: ${input.sourceLogo.description}` : "",
    input.sourceLogo.promptSummary ? `original prompt summary: ${input.sourceLogo.promptSummary}` : "",
    input.sourceLogo.lens ? `original interpretation lens: ${input.sourceLogo.lens}` : "",
    input.sourceLogo.requestSummary ? `original request summary: ${input.sourceLogo.requestSummary}` : "",
  ].filter(Boolean).join("; ");

  return [
    `Edit the attached source logo image for brand name "${input.brandName}". The attached image is the source of truth, not a loose style reference.`,
    `Do not create a fresh logo from scratch. Start from the attached image and make only the user's requested change.`,
    revisionTextRule(input.brandName),
    `Industry context only: ${input.industry}. Interpreted category: ${styleProfile.category}. Do not let industry defaults override the attached source logo.`,
    `Source logo metadata: ${sourceDetails || "source image was provided as a data PNG; preserve its established identity."}`,
    `User revision request: ${input.revisionRequest.trim()}.`,
    `Revision lens: ${variation.lens ?? variation.label}.`,
    symbolOnlyRevision
      ? "Symbol-only edit contract: Keep exact brand name text, wordmark, lettering, typography, spacing, and placement unchanged. Replace and redesign ONLY the symbol, icon, or mark. The new symbol must be visibly different in silhouette, motif, and internal shape. Do not alter, redraw, misspell, recolor, or restyle the text unless the user also explicitly asks for text changes. Do not preserve the old symbol silhouette; preserve only the overall logo layout and symbol-wordmark position."
      : `Preservation contract: keep the selected logo's core identity, visual hierarchy, composition, brand name continuity, symbol-wordmark relationship, overall silhouette, recognizable layout, color mood, line weight, typography mood, and spacing rhythm.`,
    `For the wordmark, preserve the source image lettering unless the user revision request explicitly asks for a text change. When the user names replacement text, use that requested text exactly.`,
    symbolOnlyRevision
      ? "Only modify the symbol/icon/mark that the user asked to change. Keep the wordmark frozen and do not invent a new logo concept beyond the symbol replacement."
      : `Only modify the parts explicitly requested by the user. Do not invent a new logo, do not switch to a different brand style, and do not replace the composition unless the request specifically asks for that exact part to change.`,
    `Layout: ${variation.layout}.`,
    `Typography: ${variation.typography}.`,
    `Color palette: ${variation.colorPalette}.`,
    `Concept: ${variation.concept}. Preserve source-logo cues first; use these business cues only when they do not conflict with the attached image: ${styleProfile.visualCues.join(", ")}.`,
    `Complexity: ${variation.complexity}. Keep it scalable, vector-like, balanced, and readable at business-card size.`,
    `Output: centered revised logo, strong silhouette, clean edges, print-ready composition, readable on business cards and small printed materials.`,
    `Avoid: ${logoAvoidRules.join(", ")}.`,
    hiddenQualityPrompt,
  ].join(" ");
}
