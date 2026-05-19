"use client";

import { useEffect } from "react";
import type { BrandAsset } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type BrandMockupJobResponse =
  | { jobId: string; status: "queued" | "running" }
  | { jobId: string; status: "succeeded"; asset: BrandAsset }
  | { jobId: string; status: "failed" | "cancelled"; reason: string };

function isBrandAsset(value: unknown): value is BrandAsset {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { brandId?: unknown }).brandId === "string" && typeof (value as { title?: unknown }).title === "string" && typeof (value as { description?: unknown }).description === "string" && typeof (value as { createdAt?: unknown }).createdAt === "string";
}

function readBrandMockupJobResponse(value: unknown): BrandMockupJobResponse | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as { jobId?: unknown; status?: unknown; asset?: unknown; reason?: unknown };

  if (typeof record.jobId !== "string") {
    return undefined;
  }

  if (record.status === "queued" || record.status === "running") {
    return { jobId: record.jobId, status: record.status };
  }

  if (record.status === "succeeded" && isBrandAsset(record.asset)) {
    return { jobId: record.jobId, status: record.status, asset: record.asset };
  }

  if ((record.status === "failed" || record.status === "cancelled") && typeof record.reason === "string") {
    return { jobId: record.jobId, status: record.status, reason: record.reason };
  }

  return undefined;
}

export function BrandMockupJobController() {
  const activeBrandMockupJob = usePrintyStore((state) => state.activeBrandMockupJob);
  const addBrandAssets = usePrintyStore((state) => state.addBrandAssets);
  const setActiveBrandMockupJob = usePrintyStore((state) => state.setActiveBrandMockupJob);

  useEffect(() => {
    if (!activeBrandMockupJob || activeBrandMockupJob.status !== "generating") {
      return;
    }

    const trackedJob = activeBrandMockupJob;
    let cancelled = false;

    async function pollBrandMockupJob() {
      while (!cancelled) {
        await new Promise((resolve) => window.setTimeout(resolve, 2500));

        const latestJob = usePrintyStore.getState().activeBrandMockupJob;

        if (!latestJob || latestJob.jobId !== trackedJob.jobId || latestJob.status !== "generating") {
          return;
        }

        const response = await fetch(`/api/brand-mockups/jobs/${encodeURIComponent(trackedJob.jobId)}`, { cache: "no-store" }).catch(() => undefined);

        if (!response || response.status >= 500) {
          continue;
        }

        const job = readBrandMockupJobResponse(await response.json().catch(() => undefined));

        if (!response.ok || !job || job.status === "queued" || job.status === "running") {
          continue;
        }

        if (job.status === "succeeded") {
          addBrandAssets(trackedJob.brandId, [{ ...job.asset, logoId: trackedJob.logoId }]);
          setActiveBrandMockupJob({ ...trackedJob, status: "ready", message: `${job.asset.title} 목업이 완성됐어요.`, assetId: job.asset.id });
          return;
        }

        if (job.status === "failed" || job.status === "cancelled") {
          setActiveBrandMockupJob({ ...trackedJob, status: "failed", message: job.reason });
          return;
        }
      }
    }

    void pollBrandMockupJob();

    return () => {
      cancelled = true;
    };
  }, [activeBrandMockupJob, addBrandAssets, setActiveBrandMockupJob]);

  return null;
}
