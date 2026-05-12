import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { createLogoGenerationPlans, createLogoRevisionPlans } from "@/lib/logo/logoGenerationPlans";
import { cleanupStaleUnreferencedGeneratedLogoUploads, isGeneratedLogoPublicUrl, readGeneratedLogoBytesByPublicUrl, readLogoReferenceImageBytesById, saveGeneratedLogoBytes } from "@/lib/server/storage";
import type { GeneratedLogoOption, LogoGenerationInput, LogoGenerationMode, LogoGenerationPlan, LogoGenerationResponse, LogoRevisionGenerationInput, LogoRevisionSourceLogo } from "@/lib/types";

export const runtime = "nodejs";

type InitialBrandLogoRequest = LogoGenerationInput & {
  mode: "initial";
  generationMode: LogoGenerationMode;
};

type RevisionBrandLogoRequest = LogoRevisionGenerationInput & {
  mode: "revision";
};

type BrandLogoRequest = InitialBrandLogoRequest | RevisionBrandLogoRequest;

const invalidRequestReason = "브랜드 이름과 업종은 1-100자, 디자인 요청은 1500자 이하, 수정 요청은 1-1000자로 입력해 주세요.";
const missingConfigurationReason = "이미지 생성 설정을 확인해야 해요. 관리자에게 OpenAI API 키 설정을 확인해 달라고 알려주세요.";
const usageQuotaReason = "이미지 생성 서비스를 일시적으로 사용할 수 없어요. 잠시 후 다시 시도해 주세요.";
const rateLimitReason = "요청이 너무 많아요. 10분 정도 기다린 뒤 다시 시도해 주세요.";
const modelAccessReason = "OpenAI 이미지 모델 접근 권한이 막혔어요. 조직 인증이나 모델 권한을 확인해 주세요.";
const modelUnavailableReason = "요청한 이미지 모델을 사용할 수 없어요. 모델 설정을 확인해 주세요.";
const upstreamInvalidRequestReason = "OpenAI가 요청 형식을 거절했어요. 입력을 조금 줄이거나 다르게 적어 다시 시도해 주세요.";
const upstreamTimeoutReason = "OpenAI 응답이 지연됐어요. 잠시 후 다시 시도해 주세요.";
const upstreamServerReason = "OpenAI 서버 응답이 불안정해요. 잠시 후 다시 시도해 주세요.";
const unknownUpstreamReason = "이미지 생성 중 원인을 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const openAIImageModel = "gpt-image-2";

type OpenAIImageOperation = "images.generate" | "images.edit";

type UpstreamFailureKind = "usage_quota" | "rate_limit" | "permission_model_access" | "auth_config" | "model_unavailable" | "invalid_request" | "timeout_network" | "upstream_server" | "unknown";

type HeaderGetter = {
  get: (name: string) => unknown;
};

type SafeOpenAIErrorLog = {
  failureKind: UpstreamFailureKind;
  operation: OpenAIImageOperation;
  model: typeof openAIImageModel;
  errorName: string;
  status?: number;
  code?: string;
  type?: string;
  requestID?: string;
  rateLimitHeaders?: Record<string, string>;
};

type UpstreamFailureClassification = {
  failureKind: UpstreamFailureKind;
  reason: string;
  status: number;
};

class LogoGenerationUpstreamError extends Error {
  readonly upstreamCause: unknown;

  constructor(message: string, upstreamCause: unknown) {
    super(message);
    this.name = "LogoGenerationUpstreamError";
    this.upstreamCause = upstreamCause;
  }
}

class LogoGenerationInvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoGenerationInvalidRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

function readSafeString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" && field.trim().length > 0 ? field.trim() : undefined;
}

function readSafeNumber(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function readErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  if (isRecord(error)) {
    return readSafeString(error, "name") ?? "UnknownError";
  }

  return "UnknownError";
}

function unwrapUpstreamCause(error: unknown) {
  return error instanceof LogoGenerationUpstreamError ? error.upstreamCause : error;
}

function hasHeaderGetter(value: unknown): value is HeaderGetter {
  return isRecord(value) && typeof value.get === "function";
}

function readHeaderValue(headers: unknown, headerName: string) {
  if (hasHeaderGetter(headers)) {
    const value = headers.get(headerName);

    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  }

  if (isRecord(headers)) {
    return readSafeString(headers, headerName);
  }

  return undefined;
}

function readSafeRateLimitHeaders(headers: unknown) {
  const headerNames = [
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
  ];
  const safeHeaders: Record<string, string> = {};

  for (const headerName of headerNames) {
    const value = readHeaderValue(headers, headerName);

    if (value) {
      safeHeaders[headerName] = value;
    }
  }

  return Object.keys(safeHeaders).length > 0 ? safeHeaders : undefined;
}

function readSafeOpenAIErrorLog(error: unknown, classification: UpstreamFailureClassification, operation: OpenAIImageOperation): SafeOpenAIErrorLog {
  const cause = unwrapUpstreamCause(error);
  const metadata: SafeOpenAIErrorLog = {
    failureKind: classification.failureKind,
    operation,
    model: openAIImageModel,
    errorName: readErrorName(cause),
  };

  if (!isRecord(cause)) {
    return metadata;
  }

  metadata.status = readSafeNumber(cause, "status");
  metadata.code = readSafeString(cause, "code");
  metadata.type = readSafeString(cause, "type");
  metadata.requestID = readSafeString(cause, "requestID");
  metadata.rateLimitHeaders = readSafeRateLimitHeaders(cause.headers);

  return metadata;
}

function isConnectionOrTimeoutLike(error: unknown) {
  const cause = unwrapUpstreamCause(error);
  const name = readErrorName(cause).toLowerCase();
  const code = isRecord(cause) ? readSafeString(cause, "code")?.toLowerCase() ?? "" : "";
  const type = isRecord(cause) ? readSafeString(cause, "type")?.toLowerCase() ?? "" : "";
  const markers = [name, code, type].join(" ");

  return markers.includes("timeout") || markers.includes("connection") || markers.includes("network") || markers.includes("fetch") || markers.includes("econnreset") || markers.includes("etimedout");
}

function readFailureMarkers(error: unknown) {
  const cause = unwrapUpstreamCause(error);
  const name = readErrorName(cause).toLowerCase();
  const code = isRecord(cause) ? readSafeString(cause, "code")?.toLowerCase() ?? "" : "";
  const type = isRecord(cause) ? readSafeString(cause, "type")?.toLowerCase() ?? "" : "";

  return [name, code, type].join(" ");
}

function hasQuotaMarker(markers: string) {
  return markers.includes("insufficient_quota") || markers.includes("quota") || markers.includes("billing") || markers.includes("usage_limit");
}

function hasAuthMarker(markers: string) {
  return markers.includes("invalid_api_key") || markers.includes("authentication") || markers.includes("auth");
}

function hasPermissionMarker(markers: string) {
  return markers.includes("permission") || markers.includes("access_denied") || markers.includes("not_authorized");
}

function hasModelUnavailableMarker(markers: string) {
  return markers.includes("model_not_found") || markers.includes("model_not_available") || markers.includes("model_unavailable");
}

function classifyUpstreamFailure(error: unknown): UpstreamFailureClassification {
  const cause = unwrapUpstreamCause(error);
  const status = isRecord(cause) ? readSafeNumber(cause, "status") : undefined;
  const markers = readFailureMarkers(error);

  if (status === 429 && hasQuotaMarker(markers)) {
    return { failureKind: "usage_quota", reason: usageQuotaReason, status: 429 };
  }

  if (status === 401 || hasAuthMarker(markers)) {
    return { failureKind: "auth_config", reason: missingConfigurationReason, status: 503 };
  }

  if (status === 403 || hasPermissionMarker(markers)) {
    return { failureKind: "permission_model_access", reason: modelAccessReason, status: 502 };
  }

  if (status === 404 || hasModelUnavailableMarker(markers)) {
    return { failureKind: "model_unavailable", reason: modelUnavailableReason, status: 502 };
  }

  if (status === 400) {
    return { failureKind: "invalid_request", reason: upstreamInvalidRequestReason, status: 502 };
  }

  if (status === 429) {
    return { failureKind: "rate_limit", reason: rateLimitReason, status: 429 };
  }

  if (status !== undefined && status >= 500) {
    return { failureKind: "upstream_server", reason: upstreamServerReason, status: 503 };
  }

  if (isConnectionOrTimeoutLike(error)) {
    return { failureKind: "timeout_network", reason: upstreamTimeoutReason, status: 503 };
  }

  return { failureKind: "unknown", reason: unknownUpstreamReason, status: 502 };
}

function isWithinLength(value: string, minLength: number, maxLength: number) {
  return value.length >= minLength && value.length <= maxLength;
}

function isDataPngUrl(value: string) {
  return value.startsWith("data:image/png;base64,") && value.length > "data:image/png;base64,".length;
}

function isRevisionSourceLogoUrl(value: string) {
  return isDataPngUrl(value) || isGeneratedLogoPublicUrl(value);
}

function readBase64PngData(imageUrl: string) {
  return imageUrl.slice("data:image/png;base64,".length);
}

function readOptionalString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" && field.trim().length > 0 ? field.trim() : undefined;
}

function parseSourceLogo(value: unknown): LogoRevisionSourceLogo | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value, "id");
  const imageUrl = readString(value, "imageUrl");

  if (!isWithinLength(id, 1, 200) || !isRevisionSourceLogoUrl(imageUrl)) {
    return undefined;
  }

  return {
    id,
    imageUrl,
    label: readOptionalString(value, "label"),
    description: readOptionalString(value, "description"),
    promptSummary: readOptionalString(value, "promptSummary"),
    lens: readOptionalString(value, "lens"),
    designRequest: readOptionalString(value, "designRequest"),
    requestSummary: readOptionalString(value, "requestSummary"),
  };
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local-dev-client";
}

function isRateLimited(clientKey: string) {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }

  const bucket = rateLimitBuckets.get(clientKey);

  if (!bucket) {
    rateLimitBuckets.set(clientKey, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  if (bucket.count >= rateLimitMaxRequests) {
    return true;
  }

  bucket.count += 1;
  return false;
}

function parseLogoRequest(value: unknown): BrandLogoRequest | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const brandName = readString(value, "brandName");
  const industry = readString(value, "industry") || readString(value, "category");
  const mode = value.mode === "revision" ? "revision" : "initial";

  if (!isWithinLength(brandName, 1, 100) || !isWithinLength(industry, 1, 100)) {
    return undefined;
  }

  if (mode === "revision") {
    const revisionRequest = readString(value, "revisionRequest");
    const sourceLogo = parseSourceLogo(value.sourceLogo);

    if (!isWithinLength(revisionRequest, 1, 1000) || !sourceLogo) {
      return undefined;
    }

    return {
      mode,
      brandName,
      industry,
      revisionRequest,
      sourceLogo,
    };
  }

  const designRequest = readString(value, "designRequest");
  const generationMode = value.generationMode === "auto" ? "auto" : value.generationMode === "reference" ? "reference" : "manual";
  const referenceImageId = readOptionalString(value, "referenceImageId");

  if (designRequest.length > 1500 || (generationMode === "reference" && !referenceImageId)) {
    return undefined;
  }

  return {
    mode,
    brandName,
    industry,
    designRequest,
    generationMode,
    referenceImageId,
  };
}

function makeOpenAILogo(imageUrl: string, plan: LogoGenerationPlan, index: number): GeneratedLogoOption {
  return {
    id: `openai-${Date.now()}-${index + 1}`,
    name: `${plan.label} 로고`,
    label: plan.label,
    description: plan.promptSummary,
    imageUrl,
    source: "openai",
    prompt: plan.prompt,
    promptSummary: plan.promptSummary,
    planSource: plan.source,
    lens: plan.lens,
    designRequest: plan.designRequest,
    requestSummary: plan.requestSummary,
    variationLabel: plan.label,
    keywords: [plan.lens, plan.requestSummary],
    revisionOfLogoId: plan.revisionOfLogoId,
    revisionRequest: plan.revisionRequest,
  };
}

async function generateOpenAILogo(client: OpenAI, plan: LogoGenerationPlan, index: number) {
  try {
    const response = await client.images.generate({
      model: openAIImageModel,
      prompt: plan.prompt,
      n: 1,
      size: "1024x1024",
      output_format: "png",
    });
    const image = response.data?.[0];

    if (image?.b64_json) {
      const storedImage = await saveGeneratedLogoBytes(Buffer.from(image.b64_json, "base64"));

      return makeOpenAILogo(storedImage.publicUrl, plan, index);
    }

    throw new Error("OpenAI image generation returned no image data.");
  } catch (error) {
    throw new LogoGenerationUpstreamError("OpenAI image generation failed.", error);
  }
}

async function generateOpenAIReferenceLogo(client: OpenAI, plan: LogoGenerationPlan, referenceImageId: string, index: number) {
  const referenceImage = await readLogoReferenceImageBytesById(referenceImageId);

  if (!referenceImage) {
    throw new LogoGenerationInvalidRequestError("Logo reference image is missing or unreadable.");
  }

  try {
    const forcedInstructions = referenceImage.analysis?.forcedInstructions?.trim();
    const response = await client.images.edit({
      model: openAIImageModel,
      image: await toFile(referenceImage.bytes, referenceImage.contentType === "image/png" ? "reference.png" : "reference.jpg", { type: referenceImage.contentType }),
      prompt: `${plan.prompt}\n\nUse the provided reference image only for visual direction such as mood, color, composition, and style. Do not copy protected logos, marks, characters, text, or distinctive artwork from the reference. Create a new original logo for this brand.${forcedInstructions ? `\n\nMandatory style requirements from admin: ${forcedInstructions}` : ""}`,
      n: 1,
      size: "1024x1024",
      output_format: "png",
    });
    const editedImage = response.data?.[0];

    if (editedImage?.b64_json) {
      const storedImage = await saveGeneratedLogoBytes(Buffer.from(editedImage.b64_json, "base64"));

      return makeOpenAILogo(storedImage.publicUrl, plan, index);
    }

    throw new Error("OpenAI reference image edit returned no image data.");
  } catch (error) {
    if (error instanceof LogoGenerationInvalidRequestError) {
      throw error;
    }

    throw new LogoGenerationUpstreamError("OpenAI reference image edit failed.", error);
  }
}

async function sourceLogoToUploadable(sourceLogo: LogoRevisionSourceLogo) {
  const imageBuffer = isDataPngUrl(sourceLogo.imageUrl) ? Buffer.from(readBase64PngData(sourceLogo.imageUrl), "base64") : await readGeneratedLogoBytesByPublicUrl(sourceLogo.imageUrl);

  if (!imageBuffer) {
    return undefined;
  }

  return toFile(imageBuffer, "source-logo.png", { type: "image/png" });
}

async function generateOpenAIRevisionLogo(client: OpenAI, plan: LogoGenerationPlan, sourceLogo: LogoRevisionSourceLogo, index: number) {
  const image = await sourceLogoToUploadable(sourceLogo);

  if (!image) {
    throw new LogoGenerationInvalidRequestError("Logo revision source image is missing or unreadable.");
  }

  try {
    const response = await client.images.edit({
      model: openAIImageModel,
      image,
      prompt: plan.prompt,
      n: 1,
      size: "1024x1024",
      output_format: "png",
    });
    const editedImage = response.data?.[0];

    if (editedImage?.b64_json) {
      const storedImage = await saveGeneratedLogoBytes(Buffer.from(editedImage.b64_json, "base64"));

      return makeOpenAILogo(storedImage.publicUrl, plan, index);
    }

    throw new Error("OpenAI image edit returned no image data.");
  } catch (error) {
    if (error instanceof LogoGenerationInvalidRequestError) {
      throw error;
    }

    throw new LogoGenerationUpstreamError("OpenAI image edit failed.", error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch((error: unknown) => ({ parseError: error instanceof Error ? error.name : "UnknownParseError" }));
  const parsed = parseLogoRequest(body);

  if (!parsed) {
    return NextResponse.json({ reason: invalidRequestReason }, { status: 400 });
  }

  const operation: OpenAIImageOperation = parsed.mode === "revision" || parsed.generationMode === "reference" ? "images.edit" : "images.generate";

  if (!process.env.OPENAI_API_KEY) {
    const log: SafeOpenAIErrorLog = {
      failureKind: "auth_config",
      operation,
      model: openAIImageModel,
      errorName: "MissingOpenAIConfiguration",
    };

    console.error("Logo generation failed", log);

    return NextResponse.json({ reason: missingConfigurationReason }, { status: 503 });
  }

  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json({ reason: rateLimitReason }, { status: 429 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const plans = parsed.mode === "revision" ? createLogoRevisionPlans(parsed) : createLogoGenerationPlans(parsed, parsed.generationMode);
  const plan = plans[0];

  try {
    const logo = parsed.mode === "revision" ? await generateOpenAIRevisionLogo(client, plan, parsed.sourceLogo, 0) : parsed.generationMode === "reference" && parsed.referenceImageId ? await generateOpenAIReferenceLogo(client, plan, parsed.referenceImageId, 0) : await generateOpenAILogo(client, plan, 0);
    try {
      await cleanupStaleUnreferencedGeneratedLogoUploads();
    } catch (error) {
      console.warn("Generated-logo cleanup failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    }

    const response: LogoGenerationResponse = {
      status: "success",
      logos: [logo],
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof LogoGenerationInvalidRequestError) {
      return NextResponse.json({ reason: invalidRequestReason }, { status: 400 });
    }

    const classification = classifyUpstreamFailure(error);

    console.error("Logo generation failed", readSafeOpenAIErrorLog(error, classification, operation));

    return NextResponse.json({ reason: classification.reason }, { status: classification.status });
  }
}
