import { NextResponse } from "next/server";
import { createLogoGenerationJob, getLogoGenerationClientKey, wakeLogoGenerationProcessor } from "@/lib/server/logo-generation-jobs";
import { invalidLogoGenerationRequestReason, LogoGenerationExecutionError, LogoGenerationRequestValidationError } from "@/lib/server/logo-generation-executor";
import type { LogoGenerationJobCreateResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch((error: unknown) => ({ parseError: error instanceof Error ? error.name : "UnknownParseError" }));

  try {
    const response: LogoGenerationJobCreateResponse = await createLogoGenerationJob(body, getLogoGenerationClientKey(request));
    wakeLogoGenerationProcessor();

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    if (error instanceof LogoGenerationRequestValidationError) {
      return NextResponse.json({ reason: invalidLogoGenerationRequestReason }, { status: 400 });
    }

    if (error instanceof LogoGenerationExecutionError) {
      console.warn("Logo generation job rejected", error.log);

      return NextResponse.json({ reason: error.classification.reason }, { status: error.classification.status });
    }

    console.error("Logo generation job creation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: "이미지 생성 요청을 접수하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }
}
