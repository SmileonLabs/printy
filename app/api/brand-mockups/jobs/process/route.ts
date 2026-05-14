import { NextResponse } from "next/server";
import { processBrandMockupJobs } from "@/lib/server/brand-mockup-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const configuredToken = process.env.PRINTY_JOB_PROCESSOR_TOKEN?.trim();
  const providedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!configuredToken || providedToken !== configuredToken) {
    return NextResponse.json({ reason: "Not found." }, { status: 404 });
  }

  const result = await processBrandMockupJobs();

  return NextResponse.json(result);
}
