import "server-only";

import type { LogoReferenceImageAnalysis } from "@/lib/types";

const defaultReferenceAnalysisModel = "gpt-4.1-mini";
const maxAnalysisTextLength = 700;

type LogoReferenceAnalysisSource = LogoReferenceImageAnalysis["source"];

function trimText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  return trimmed.length > 0 ? trimmed.slice(0, maxAnalysisTextLength) : fallback;
}

function hasKoreanText(value: string) {
  return /[가-힣]/.test(value);
}

function hasEnglishWords(value: string) {
  return /[A-Za-z]{3,}/.test(value);
}

function trimKoreanText(value: unknown, fallback: string) {
  const text = trimText(value, fallback);

  return hasKoreanText(text) && !hasEnglishWords(text) ? text : fallback;
}

function readStyleTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter((item, index, items) => item.length > 0 && hasKoreanText(item) && !hasEnglishWords(item) && items.indexOf(item) === index)
    .slice(0, 8);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOutputText(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const outputText = value.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText.trim();
  }

  const output = value.output;

  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string" && content.text.trim().length > 0) {
        return content.text.trim();
      }
    }
  }

  return undefined;
}

function parseAnalysisJson(text: string, source: LogoReferenceAnalysisSource, model: string): LogoReferenceImageAnalysis {
  const jsonText = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const parsed: unknown = JSON.parse(jsonText);

  if (!isRecord(parsed)) {
    throw new Error("Reference image analysis was not an object.");
  }

  return {
    status: "ready",
    source,
    summary: trimKoreanText(parsed.summary, "참고 이미지의 스타일 분석을 완료했어요."),
    styleTags: readStyleTags(parsed.styleTags),
    colorNotes: trimKoreanText(parsed.colorNotes, "색감 특징을 확인했어요."),
    compositionNotes: trimKoreanText(parsed.compositionNotes, "구도 특징을 확인했어요."),
    cautionNotes: trimKoreanText(parsed.cautionNotes, "원본 로고, 문자, 캐릭터, 고유 표식은 복제하지 않고 분위기만 참고해야 해요."),
    forcedInstructions: undefined,
    analyzedAt: new Date().toISOString(),
    model,
  };
}

function fallbackAnalysis(source: LogoReferenceAnalysisSource, status: "skipped" | "failed", reason: string): LogoReferenceImageAnalysis {
  return {
    status,
    source,
    summary: reason,
    styleTags: [],
    colorNotes: "분석 데이터 없음",
    compositionNotes: "분석 데이터 없음",
    cautionNotes: "생성 시 원본 이미지는 직접 첨부하되, 원본 로고/문자/고유 표식은 복제하지 않도록 프롬프트에서 제한해요.",
    forcedInstructions: undefined,
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeLogoReferenceImage(bytes: Uint8Array, contentType: "image/png" | "image/jpeg", source: LogoReferenceAnalysisSource): Promise<LogoReferenceImageAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackAnalysis(source, "skipped", "OpenAI API 키가 없어 업로드 시 자동 분석은 건너뛰었어요.");
  }

  const model = process.env.OPENAI_REFERENCE_ANALYSIS_MODEL?.trim() || defaultReferenceAnalysisModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "이 이미지를 로고 제작 레퍼런스 관리용으로 분석해 주세요. 반드시 한국어 JSON만 반환하고 키는 summary, styleTags, colorNotes, compositionNotes, cautionNotes만 사용하세요. 모든 값은 한국어 문장 또는 한국어 태그여야 합니다. 영어 단어, 영어 태그, 브랜드명 추정, 브랜드 식별은 쓰지 마세요. summary는 1문장, styleTags는 한국어 명사형 태그 3~6개, colorNotes/compositionNotes/cautionNotes는 각각 짧은 한국어 문장으로 작성하세요. 참고할 시각 스타일과 복제하면 안 되는 요소를 명확하게 적어 주세요.",
              },
              {
                type: "input_image",
                image_url: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return fallbackAnalysis(source, "failed", "OpenAI 분석 요청이 실패했어요. 이미지는 등록됐고 생성 시 원본 이미지는 그대로 첨부돼요.");
    }

    const outputText = readOutputText(await response.json());

    if (!outputText) {
      return fallbackAnalysis(source, "failed", "OpenAI 분석 응답에서 텍스트를 찾지 못했어요. 이미지는 등록됐고 생성 시 원본 이미지는 그대로 첨부돼요.");
    }

    return parseAnalysisJson(outputText, source, model);
  } catch {
    return fallbackAnalysis(source, "failed", "이미지 분석 중 오류가 발생했어요. 이미지는 등록됐고 생성 시 원본 이미지는 그대로 첨부돼요.");
  } finally {
    clearTimeout(timeout);
  }
}
