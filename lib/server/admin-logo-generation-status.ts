import "server-only";

import type { LogoGenerationJobStatus } from "@/lib/types";
import { withDbClient } from "@/lib/server/db";

export type AdminLogoGenerationBrandStatus = {
  brandId: string | null;
  brandName: string;
  category: string;
  selectedLogoId: string;
  logoCount: number;
  latestLogoImageUrl: string;
  latestLogoUpdatedAt: string;
  jobs: Record<LogoGenerationJobStatus, number> & { total: number };
  latestJobUpdatedAt: string;
  latestFailureKind: string;
  latestFailureReason: string;
};

export type AdminLogoGenerationAccountStatus = {
  user: {
    id: string;
    name: string;
    contact: string;
    email: string;
  };
  brands: AdminLogoGenerationBrandStatus[];
};

type LogoGenerationStatusRow = {
  user_id: string;
  user_name: string;
  user_contact: string | null;
  user_email: string | null;
  brand_id: string | null;
  brand_name: string;
  brand_category: string;
  selected_logo_id: string | null;
  logo_count: string;
  latest_logo_image_url: string | null;
  latest_logo_updated_at: Date | null;
  total_jobs: string;
  queued_jobs: string;
  running_jobs: string;
  succeeded_jobs: string;
  failed_jobs: string;
  cancelled_jobs: string;
  latest_job_updated_at: Date | null;
  latest_failure_kind: string | null;
  latest_failure_reason: string | null;
};

const emptyJobCounts: Record<LogoGenerationJobStatus, number> & { total: number } = {
  total: 0,
  queued: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
};

function readCount(value: string | number | null | undefined) {
  const count = Number(value ?? 0);

  return Number.isFinite(count) ? count : 0;
}

function normalizeAdminLogoImageUrl(value: string | null) {
  if (!value) {
    return "";
  }

  if (value.startsWith("/uploads/")) {
    return value;
  }

  try {
    const url = new URL(value);

    return url.pathname.startsWith("/uploads/") ? url.pathname : value;
  } catch {
    return value;
  }
}

function createBrandStatus(row: LogoGenerationStatusRow): AdminLogoGenerationBrandStatus {
  return {
    brandId: row.brand_id,
    brandName: row.brand_name,
    category: row.brand_category,
    selectedLogoId: row.selected_logo_id ?? "",
    logoCount: readCount(row.logo_count),
    latestLogoImageUrl: normalizeAdminLogoImageUrl(row.latest_logo_image_url),
    latestLogoUpdatedAt: row.latest_logo_updated_at?.toISOString() ?? "",
    jobs: {
      total: readCount(row.total_jobs),
      queued: readCount(row.queued_jobs),
      running: readCount(row.running_jobs),
      succeeded: readCount(row.succeeded_jobs),
      failed: readCount(row.failed_jobs),
      cancelled: readCount(row.cancelled_jobs),
    },
    latestJobUpdatedAt: row.latest_job_updated_at?.toISOString() ?? "",
    latestFailureKind: row.latest_failure_kind ?? "",
    latestFailureReason: row.latest_failure_reason ?? "",
  };
}

function ensureAccount(accounts: Map<string, AdminLogoGenerationAccountStatus>, row: LogoGenerationStatusRow) {
  const existing = accounts.get(row.user_id);

  if (existing) {
    return existing;
  }

  const account: AdminLogoGenerationAccountStatus = {
    user: {
      id: row.user_id,
      name: row.user_name,
      contact: row.user_contact ?? "",
      email: row.user_email ?? "",
    },
    brands: [],
  };

  accounts.set(row.user_id, account);

  return account;
}

export async function listAdminLogoGenerationStatus(): Promise<AdminLogoGenerationAccountStatus[]> {
  return withDbClient(async (client) => {
    const brandRows = await client.query<LogoGenerationStatusRow>(
      `
        with logo_counts as (
          select
            user_id,
            brand_id,
            count(*)::text as logo_count,
            (array_agg(payload->>'imageUrl' order by updated_at desc))[1] as latest_logo_image_url,
            max(updated_at) as latest_logo_updated_at
          from generated_logos
          group by user_id, brand_id
        ),
        job_counts as (
          select
            jobs.user_id,
            brands.id as brand_id,
            count(*)::text as total_jobs,
            count(*) filter (where jobs.status = 'queued')::text as queued_jobs,
            count(*) filter (where jobs.status = 'running')::text as running_jobs,
            count(*) filter (where jobs.status = 'succeeded')::text as succeeded_jobs,
            count(*) filter (where jobs.status = 'failed')::text as failed_jobs,
            count(*) filter (where jobs.status = 'cancelled')::text as cancelled_jobs,
            max(jobs.updated_at) as latest_job_updated_at,
            (array_agg(jobs.failure_kind order by jobs.updated_at desc) filter (where jobs.failure_kind is not null))[1] as latest_failure_kind,
            (array_agg(jobs.failure_reason order by jobs.updated_at desc) filter (where jobs.failure_reason is not null))[1] as latest_failure_reason
          from logo_generation_jobs jobs
          join brands on brands.user_id = jobs.user_id and lower(brands.name) = lower(coalesce(jobs.request_payload->>'brandName', ''))
          group by jobs.user_id, brands.id
        )
        select
          users.id::text as user_id,
          users.name as user_name,
          users.contact as user_contact,
          users.email as user_email,
          brands.id as brand_id,
          brands.name as brand_name,
          brands.category as brand_category,
          brands.selected_logo_id,
          coalesce(logo_counts.logo_count, '0') as logo_count,
          logo_counts.latest_logo_image_url,
          logo_counts.latest_logo_updated_at,
          coalesce(job_counts.total_jobs, '0') as total_jobs,
          coalesce(job_counts.queued_jobs, '0') as queued_jobs,
          coalesce(job_counts.running_jobs, '0') as running_jobs,
          coalesce(job_counts.succeeded_jobs, '0') as succeeded_jobs,
          coalesce(job_counts.failed_jobs, '0') as failed_jobs,
          coalesce(job_counts.cancelled_jobs, '0') as cancelled_jobs,
          job_counts.latest_job_updated_at,
          job_counts.latest_failure_kind,
          job_counts.latest_failure_reason
        from brands
        join users on users.id = brands.user_id
        left join logo_counts on logo_counts.user_id = brands.user_id and logo_counts.brand_id = brands.id
        left join job_counts on job_counts.user_id = brands.user_id and job_counts.brand_id = brands.id
        order by users.updated_at desc, brands.updated_at desc
        limit 500
      `,
    );

    const unmatchedRows = await client.query<LogoGenerationStatusRow>(
      `
        with unmatched_jobs as (
          select jobs.*
          from logo_generation_jobs jobs
          where jobs.user_id is not null
            and not exists (
              select 1
              from brands
              where brands.user_id = jobs.user_id
                and lower(brands.name) = lower(coalesce(jobs.request_payload->>'brandName', ''))
            )
        ),
        unmatched_generated_logos as (
          select generated_logos.*
          from generated_logos
          where generated_logos.brand_id is null
            or not exists (
              select 1
              from brands
              where brands.user_id = generated_logos.user_id
                and brands.id = generated_logos.brand_id
            )
        ),
        unmatched_logo_counts as (
          select
            user_id,
            count(*)::text as logo_count,
            (array_agg(payload->>'imageUrl' order by updated_at desc))[1] as latest_logo_image_url,
            max(updated_at) as latest_logo_updated_at
          from unmatched_generated_logos
          group by user_id
        ),
        unmatched_job_counts as (
          select
            user_id,
            coalesce(nullif(btrim(request_payload->>'brandName'), ''), '브랜드 미확인') as brand_name,
            coalesce(nullif(btrim(request_payload->>'industry'), ''), nullif(btrim(request_payload->>'category'), ''), '') as brand_category,
            count(*)::text as total_jobs,
            count(*) filter (where status = 'queued')::text as queued_jobs,
            count(*) filter (where status = 'running')::text as running_jobs,
            count(*) filter (where status = 'succeeded')::text as succeeded_jobs,
            count(*) filter (where status = 'failed')::text as failed_jobs,
            count(*) filter (where status = 'cancelled')::text as cancelled_jobs,
            max(updated_at) as latest_job_updated_at,
            (array_agg(failure_kind order by updated_at desc) filter (where failure_kind is not null))[1] as latest_failure_kind,
            (array_agg(failure_reason order by updated_at desc) filter (where failure_reason is not null))[1] as latest_failure_reason
          from unmatched_jobs
          group by user_id, coalesce(nullif(btrim(request_payload->>'brandName'), ''), '브랜드 미확인'), coalesce(nullif(btrim(request_payload->>'industry'), ''), nullif(btrim(request_payload->>'category'), ''), '')
        )
        select
          users.id::text as user_id,
          users.name as user_name,
          users.contact as user_contact,
          users.email as user_email,
          null::text as brand_id,
          unmatched_job_counts.brand_name,
          unmatched_job_counts.brand_category,
          null::text as selected_logo_id,
          coalesce(unmatched_logo_counts.logo_count, '0') as logo_count,
          unmatched_logo_counts.latest_logo_image_url,
          unmatched_logo_counts.latest_logo_updated_at,
          unmatched_job_counts.total_jobs,
          unmatched_job_counts.queued_jobs,
          unmatched_job_counts.running_jobs,
          unmatched_job_counts.succeeded_jobs,
          unmatched_job_counts.failed_jobs,
          unmatched_job_counts.cancelled_jobs,
          unmatched_job_counts.latest_job_updated_at,
          unmatched_job_counts.latest_failure_kind,
          unmatched_job_counts.latest_failure_reason
        from unmatched_job_counts
        join users on users.id = unmatched_job_counts.user_id
        left join unmatched_logo_counts on unmatched_logo_counts.user_id = unmatched_job_counts.user_id
        order by users.updated_at desc, unmatched_job_counts.latest_job_updated_at desc
        limit 200
      `,
    );

    const accounts = new Map<string, AdminLogoGenerationAccountStatus>();

    for (const row of [...brandRows.rows, ...unmatchedRows.rows]) {
      const account = ensureAccount(accounts, row);
      account.brands.push(createBrandStatus(row));
    }

    return Array.from(accounts.values()).map((account) => ({
      ...account,
      brands: account.brands.sort((left, right) => {
        const leftTime = left.latestJobUpdatedAt || left.latestLogoUpdatedAt;
        const rightTime = right.latestJobUpdatedAt || right.latestLogoUpdatedAt;

        return rightTime.localeCompare(leftTime);
      }),
    }));
  });
}

export { emptyJobCounts };
