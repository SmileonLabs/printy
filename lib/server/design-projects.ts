import "server-only";

import { normalizeDesignProject } from "@/lib/design-projects";
import type { DesignProject } from "@/lib/design-projects";
import { withDbClient } from "@/lib/server/db";

type DesignProjectRow = {
  id: string;
  payload: unknown;
};

async function ensureDesignProjectTable(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    create table if not exists design_projects (
      user_id text not null,
      id text not null,
      brand_id text not null,
      product_type text not null,
      status text not null,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    )
  `);
  await client.query("create index if not exists design_projects_user_brand_updated_idx on design_projects (user_id, brand_id, updated_at desc)");
  await client.query("create index if not exists design_projects_user_product_updated_idx on design_projects (user_id, product_type, updated_at desc)");
}

function toProject(row: DesignProjectRow) {
  return normalizeDesignProject(row.payload);
}

export async function loadDesignProjects(userId: string, brandId?: string) {
  return withDbClient(async (client) => {
    await ensureDesignProjectTable(client);

    const result = brandId
      ? await client.query<DesignProjectRow>(
          `
            select id, payload
            from design_projects
            where user_id = $1 and brand_id = $2
            order by updated_at desc, created_at desc
          `,
          [userId, brandId],
        )
      : await client.query<DesignProjectRow>(
          `
            select id, payload
            from design_projects
            where user_id = $1
            order by updated_at desc, created_at desc
          `,
          [userId],
        );

    return result.rows.map(toProject).filter((project): project is DesignProject => project !== undefined);
  });
}

export async function loadDesignProject(userId: string, projectId: string) {
  return withDbClient(async (client) => {
    await ensureDesignProjectTable(client);

    const result = await client.query<DesignProjectRow>(
      `
        select id, payload
        from design_projects
        where user_id = $1 and id = $2
        limit 1
      `,
      [userId, projectId],
    );

    return result.rows[0] ? toProject(result.rows[0]) : undefined;
  });
}

export async function saveDesignProject(userId: string, project: DesignProject) {
  const validProject = normalizeDesignProject(project);

  if (!validProject) {
    throw new Error("Invalid design project payload.");
  }

  const now = new Date().toISOString();
  const projectToSave: DesignProject = {
    ...validProject,
    updatedAt: now,
    createdAt: validProject.createdAt || now,
  };

  return withDbClient(async (client) => {
    await ensureDesignProjectTable(client);
    await client.query(
      `
        insert into design_projects (user_id, id, brand_id, product_type, status, payload, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        on conflict (user_id, id) do update set
          brand_id = excluded.brand_id,
          product_type = excluded.product_type,
          status = excluded.status,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      [userId, projectToSave.id, projectToSave.brandId, projectToSave.productType, projectToSave.status, JSON.stringify(projectToSave), projectToSave.createdAt, projectToSave.updatedAt],
    );

    return projectToSave;
  });
}

export async function deleteDesignProject(userId: string, projectId: string) {
  return withDbClient(async (client) => {
    await ensureDesignProjectTable(client);

    const result = await client.query(
      `
        delete from design_projects
        where user_id = $1 and id = $2
      `,
      [userId, projectId],
    );

    return (result.rowCount ?? 0) > 0;
  });
}
