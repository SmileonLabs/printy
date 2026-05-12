import type { LogoGenerationInput, LogoGenerationMode, LogoGenerationPlan, LogoPlanSource, LogoRevisionGenerationInput, LogoVariationDraft } from "@/lib/types";
import { mapIndustryStyle, type IndustryStyleProfile } from "@/lib/logo/industryStyleMapper";
import { buildLogoPrompt, buildLogoRevisionPrompt, isSymbolOnlyRevisionRequest } from "@/lib/logo/logoPromptBuilder";

type InterpretationLens = {
  id: string;
  label: string;
  lens: string;
  focus: string;
  layout: string;
  typography: string;
  colorPalette: string;
  concept: string;
  complexity: string;
};

const interpretationLens: InterpretationLens = {
  id: "faithful-direct",
  label: "요청 충실형",
  lens: "사용자가 쓴 문장을 가장 직접적으로 해석",
  focus: "사용자가 원한다고 적은 요소를 우선하고, 피하고 싶다고 적은 요소는 제외합니다.",
  layout: "composition follows the user's requested hierarchy first, then balances it for a logo lockup",
  typography: "lettering mirrors the user's requested tone while keeping the exact brand name readable",
  colorPalette: "palette follows any user-stated color wishes, then uses industry-safe contrast if no color is stated",
  concept: "direct interpretation of the user's natural-language logo request",
  complexity: "controlled detail, preserving the user's idea without adding unrelated motifs",
};

const revisionLens: InterpretationLens = {
  id: "revision-faithful-safe",
  label: "원본 유지형",
  lens: "선택한 로고의 핵심 형태를 거의 그대로 유지하는 최소 수정",
  focus: "사용자 요청 중 반드시 필요한 부분만 가장 안전하게 반영하고 원본의 중심 구도와 인상은 유지합니다.",
  layout: "preserve the source logo layout, spacing rhythm, hierarchy, symbol placement, and wordmark relationship with only minimal requested adjustments",
  typography: "preserve original brand-name lettering continuity and only adjust type details if the request explicitly asks",
  colorPalette: "preserve the original palette unless the request names a color change, then make the smallest necessary palette adjustment",
  concept: "faithful revision of the selected source logo without changing its identity",
  complexity: "minimal change, safest edit, no new unrelated motifs",
};

function getRevisionLensForRequest(lens: InterpretationLens, symbolOnlyRevision: boolean): InterpretationLens {
  if (!symbolOnlyRevision) {
    return lens;
  }

  return {
    ...lens,
    layout: "keep the original wordmark placement and replace the symbol with a simpler new mark in the same position",
    concept: "new simpler symbol, same placement, while the text remains fixed",
    complexity: "minimal change, new simpler symbol, same placement",
  };
}

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function makeAutoRequest(input: LogoGenerationInput, styleProfile: IndustryStyleProfile) {
  const brandContext = `${input.brandName}(${input.industry})`;

  return `${brandContext} 업종의 ${styleProfile.visualCues[0]}을 살려 첫눈에 업종이 이해되는 로고로 해석해 주세요. ${styleProfile.symbols[0]} 같은 상징은 은근하게만 사용하고 브랜드명 가독성을 우선해 주세요.`;
}

function getRequest(input: LogoGenerationInput, request: string, styleProfile: IndustryStyleProfile) {
  if (request.length === 0) {
    return makeAutoRequest(input, styleProfile);
  }

  return request;
}

function makeSummary(input: LogoGenerationInput, lens: InterpretationLens, designRequest: string, source: LogoPlanSource) {
  const prefix = source === "user" ? "입력 해석" : "Printy 작성";

  return `${prefix}: ${input.brandName}의 ${input.industry} 로고를 '${lens.lens}' 렌즈로 해석합니다. 요청 요약: ${designRequest}`;
}

function toPlan(input: LogoGenerationInput, lens: InterpretationLens, designRequest: string, source: LogoPlanSource, styleProfile: IndustryStyleProfile): LogoGenerationPlan {
  const requestSummary = designRequest.length > 84 ? `${designRequest.slice(0, 84)}...` : designRequest;
  const promptSummary = makeSummary(input, lens, requestSummary, source);
  const variation: LogoVariationDraft = {
    id: lens.id,
    label: lens.label,
    source,
    lens: lens.lens,
    designRequest,
    requestSummary,
    promptSummary,
    layout: `${lens.layout}; lens focus: ${lens.focus}`,
    typography: lens.typography,
    colorPalette: `${lens.colorPalette}; industry cues: ${styleProfile.paletteHints.join(", ")}`,
    concept: `${lens.concept}; connect to ${styleProfile.visualCues.join(", ")} and symbolic cues ${styleProfile.symbols.join(", ")}`,
    complexity: lens.complexity,
  };

  return {
    ...variation,
    source,
    lens: lens.lens,
    designRequest,
    requestSummary,
    promptSummary,
    prompt: buildLogoPrompt({ ...input, designRequest }, variation, styleProfile),
  };
}

export function createLogoGenerationPlans(input: LogoGenerationInput, mode: LogoGenerationMode): LogoGenerationPlan[] {
  const request = mode === "manual" ? compact(input.designRequest) : "";
  const requestForStyle = request || `${input.industry} ${input.brandName}`;
  const styleProfile = mapIndustryStyle(input.industry, requestForStyle);
  const designRequest = getRequest(input, request, styleProfile);
  const source: LogoPlanSource = request.length > 0 ? "user" : "recommended";
  return [toPlan(input, interpretationLens, designRequest, source, styleProfile)];
}

export function createLogoRevisionPlans(input: LogoRevisionGenerationInput): LogoGenerationPlan[] {
  const revisionRequest = compact(input.revisionRequest);
  const sourceContext = [input.sourceLogo.label, input.sourceLogo.description, input.sourceLogo.promptSummary, input.sourceLogo.requestSummary].filter(Boolean).join(" ");
  const styleProfile = mapIndustryStyle(input.industry, `${revisionRequest} ${sourceContext}`);
  const symbolOnlyRevision = isSymbolOnlyRevisionRequest(revisionRequest);

  const selectedRevisionLens = getRevisionLensForRequest(revisionLens, symbolOnlyRevision);

  const requestSummary = revisionRequest.length > 84 ? `${revisionRequest.slice(0, 84)}...` : revisionRequest;
  const promptSummary = `수정 요청: ${input.brandName}의 선택 로고를 '${selectedRevisionLens.lens}' 렌즈로 보존 수정합니다. 요청 요약: ${requestSummary}`;
  const variation: LogoVariationDraft = {
    id: selectedRevisionLens.id,
    label: selectedRevisionLens.label,
    source: "user",
    lens: selectedRevisionLens.lens,
    designRequest: revisionRequest,
    requestSummary,
    promptSummary,
    revisionOfLogoId: input.sourceLogo.id,
    revisionRequest,
    layout: `${selectedRevisionLens.layout}; revision focus: ${selectedRevisionLens.focus}`,
    typography: selectedRevisionLens.typography,
    colorPalette: `${selectedRevisionLens.colorPalette}; industry cues: ${styleProfile.paletteHints.join(", ")}`,
    concept: `${selectedRevisionLens.concept}; source logo metadata must dominate over new industry cues`,
    complexity: selectedRevisionLens.complexity,
  };

  return [
    {
      ...variation,
      source: "user",
      lens: selectedRevisionLens.lens,
      designRequest: revisionRequest,
      requestSummary,
      promptSummary,
      revisionOfLogoId: input.sourceLogo.id,
      revisionRequest,
      prompt: buildLogoRevisionPrompt(input, variation, styleProfile),
    },
  ];
}
