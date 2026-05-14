import { NextResponse } from "next/server";
import { processLogoGenerationJobs } from "@/lib/server/logo-generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredToken = process.env.PRINTY_JOB_PROCESSOR_TOKEN?.trim();
  const providedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!configuredToken || providedToken !== configuredToken) {
    return NextResponse.json({ reason: "Not found." }, { status: 404 });
  }

  const result = await processLogoGenerationJobs();

  return NextResponse.json(result);
}
