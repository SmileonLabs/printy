import { NextResponse } from "next/server";
import { processAiBusinessCardJobs, readAiBusinessCardJob } from "@/lib/server/ai-business-card-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiBusinessCardJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: AiBusinessCardJobRouteContext) {
  const { jobId } = await context.params;
  const job = await readAiBusinessCardJob(jobId);

  if (!job) {
    return NextResponse.json({ reason: "작업을 찾지 못했어요." }, { status: 404 });
  }

  if (job.status === "queued") {
    await processAiBusinessCardJobs();

    const refreshedJob = await readAiBusinessCardJob(jobId);

    if (refreshedJob) {
      return NextResponse.json(refreshedJob, { headers: { "Cache-Control": "no-store" } });
    }
  }

  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
