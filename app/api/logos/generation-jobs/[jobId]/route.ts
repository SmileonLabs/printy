import { NextResponse } from "next/server";
import { readLogoGenerationJob, wakeLogoGenerationProcessor } from "@/lib/server/logo-generation-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogoGenerationJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: LogoGenerationJobRouteContext) {
  const { jobId } = await context.params;
  const job = await readLogoGenerationJob(jobId);

  if (!job) {
    return NextResponse.json({ reason: "로고 생성 작업을 찾지 못했어요." }, { status: 404 });
  }

  if (job.status === "queued") {
    wakeLogoGenerationProcessor();
  }

  return NextResponse.json(job);
}
