import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";
import { vectorizeGeneratedLogo } from "@/lib/server/logo-vectorizer";
import { saveGeneratedLogoBytes, saveGeneratedLogoSvg } from "@/lib/server/storage";
import type { GeneratedLogoOption } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxUploadBytes = 8 * 1024 * 1024;
const uploadRestoreTimeoutMs = 45_000;
const supportedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const defaultOpenAIImageModel = "gpt-image-2";

function readTextField(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function readOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || defaultOpenAIImageModel;
}

function buildPrompt(brandName: string, category: string) {
  return `Restore the provided image as a clean production-ready brand logo for ${brandName}${category ? `, ${category}` : ""}. Preserve the uploaded logo's layout, symbol, lettering, colors, proportions, and overall identity as closely as possible. Do not redesign it, do not add new text, and do not turn it into a mockup, photo, scene, or packaging render. Produce a centered logo on a clean transparent or plain background, crisp PNG, suitable for printing and mockup generation. If the source image is low resolution, carefully reconstruct edges while keeping the same design.`;
}

function makeUploadedLogo(imageUrl: string, brandName: string, category: string, vectorSvgUrl?: string): GeneratedLogoOption {
  return {
    id: `uploaded-openai-${Date.now()}`,
    name: `${brandName || "내 브랜드"} 등록 로고`,
    label: "내 로고",
    description: "업로드한 이미지를 인쇄와 목업에 쓰기 좋게 정리한 로고예요.",
    imageUrl,
    vectorSvgUrl,
    source: "openai",
    promptSummary: "업로드 이미지를 최대한 보존해 정리",
    planSource: "user",
    lens: "내 로고 등록",
    designRequest: `${brandName}${category ? ` · ${category}` : ""} 기존 로고 이미지 정리`,
    requestSummary: "가지고 있는 로고 이미지를 그대로 살려 PNG로 정리",
    variationLabel: "내 로고",
    keywords: ["uploaded-logo", "restored-logo"],
  };
}

async function restoreUploadedLogoImage(client: OpenAI, inputBytes: Buffer, file: File, brandName: string, category: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), uploadRestoreTimeoutMs);

  try {
    const response = await client.images.edit({
      model: readOpenAIImageModel(),
      image: await toFile(inputBytes, file.name || "uploaded-logo.png", { type: file.type }),
      prompt: buildPrompt(brandName, category),
      n: 1,
      size: "1024x1024",
      output_format: "png",
    }, { signal: controller.signal });

    return response.data?.[0]?.b64_json ? Buffer.from(response.data[0].b64_json, "base64") : undefined;
  } catch (error) {
    if (controller.signal.aborted) {
      return undefined;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readUploadErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : undefined;
}

function readUploadErrorString(error: unknown, key: "code" | "type") {
  if (typeof error !== "object" || error === null || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<"code" | "type", unknown>)[key];

  return typeof value === "string" ? value : undefined;
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => undefined);

  if (!formData) {
    return NextResponse.json({ reason: "업로드 요청을 읽을 수 없어요." }, { status: 400 });
  }

  const brandName = readTextField(formData.get("brandName"));
  const category = readTextField(formData.get("category"));
  const file = formData.get("file");

  if (!brandName || !category) {
    return NextResponse.json({ reason: "브랜드 이름과 업종을 먼저 입력해 주세요." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ reason: "등록할 로고 이미지 파일을 선택해 주세요." }, { status: 400 });
  }

  if (!supportedContentTypes.has(file.type)) {
    return NextResponse.json({ reason: "PNG, JPG, WEBP 이미지만 등록할 수 있어요." }, { status: 415 });
  }

  if (file.size <= 0 || file.size > maxUploadBytes) {
    return NextResponse.json({ reason: "이미지 파일은 8MB 이하로 올려 주세요." }, { status: 413 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ reason: "이미지 정리 설정을 확인해야 해요. 관리자에게 OpenAI API 키 설정을 확인해 달라고 알려주세요." }, { status: 503 });
  }

  try {
    const inputBytes = Buffer.from(await file.arrayBuffer());
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const restoredBytes = await restoreUploadedLogoImage(client, inputBytes, file, brandName, category);

    if (!restoredBytes) {
      return NextResponse.json({ reason: "로고 AI 정리가 오래 걸렸어요. 잠시 후 다시 시도해 주세요." }, { status: 504 });
    }

    const storedImage = await saveGeneratedLogoBytes(restoredBytes);
    const storedVector = await vectorizeGeneratedLogo(restoredBytes).then((svg) => saveGeneratedLogoSvg(svg)).catch(() => undefined);
    const logo = makeUploadedLogo(storedImage.publicUrl, brandName, category, storedVector?.publicUrl);

    return NextResponse.json({ logo });
  } catch (error) {
    const status = readUploadErrorStatus(error);
    const code = readUploadErrorString(error, "code");
    const type = readUploadErrorString(error, "type");

    console.warn("Uploaded logo restoration failed", { errorName: error instanceof Error ? error.name : "UnknownError", status, code, type });

    if (status === 400) {
      return NextResponse.json({ reason: "업로드한 이미지를 AI가 정리할 수 없어요. 더 선명한 로고 이미지로 다시 시도해 주세요." }, { status: 422 });
    }

    if (status === 401 || status === 403) {
      return NextResponse.json({ reason: "이미지 정리 권한 설정을 확인해야 해요. 관리자에게 OpenAI 설정을 확인해 달라고 알려주세요." }, { status: 503 });
    }

    if (status === 429) {
      return NextResponse.json({ reason: "이미지 정리 요청이 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    return NextResponse.json({ reason: "로고 이미지를 정리하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
