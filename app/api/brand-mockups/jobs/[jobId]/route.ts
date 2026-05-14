import { NextResponse } from "next/server";
import { readBrandMockupJob, wakeBrandMockupProcessor } from "@/lib/server/brand-mockup-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BrandMockupJobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: BrandMockupJobRouteContext) {
  const { jobId } = await context.params;
  const job = await readBrandMockupJob(jobId);

  if (!job) {
    return NextResponse.json({ reason: "목업 생성 작업을 찾지 못했어요." }, { status: 404 });
  }

  if (job.status === "queued") {
    wakeBrandMockupProcessor();
  }

  return NextResponse.json(job);
}
