import "server-only";

import { withDbClient } from "@/lib/server/db";

export type AdminBrandTransferUser = {
  id: string;
  name: string;
  contact: string;
  email: string;
};

export type AdminBrandTransferBrand = {
  userId: string;
  id: string;
  name: string;
  category: string;
  selectedLogoId: string;
  logoCount: number;
  draftCount: number;
  orderCount: number;
  assetCount: number;
  updatedAt: string;
};

export type AdminBrandTransferResult = {
  brand: AdminBrandTransferBrand;
  fromUserId: string;
  toUserId: string;
  moved: {
    logos: number;
    drafts: number;
    orders: number;
    assets: number;
  };
};

type UserRow = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
};

type BrandRow = {
  user_id: string;
  id: string;
  name: string;
  category: string;
  selected_logo_id: string;
  logo_count: string | number;
  draft_count: string | number;
  order_count: string | number;
  asset_count: string | number;
  updated_at: Date;
};

type CountRow = {
  count: string;
};

function readCount(value: string | number) {
  const count = typeof value === "number" ? value : Number(value);

  return Number.isFinite(count) ? count : 0;
}

function toUser(row: UserRow): AdminBrandTransferUser {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact ?? "",
    email: row.email ?? "",
  };
}

function toBrand(row: BrandRow): AdminBrandTransferBrand {
  return {
    userId: row.user_id,
    id: row.id,
    name: row.name,
    category: row.category,
    selectedLogoId: row.selected_logo_id,
    logoCount: readCount(row.logo_count),
    draftCount: readCount(row.draft_count),
    orderCount: readCount(row.order_count),
    assetCount: readCount(row.asset_count),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function readBrandRows(client: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }) {
  const result = await client.query<BrandRow>(
    `
      select
        brands.user_id::text,
        brands.id,
        brands.name,
        brands.category,
        brands.selected_logo_id,
        coalesce(logos.logo_count, '0') as logo_count,
        coalesce(drafts.draft_count, '0') as draft_count,
        coalesce(orders.order_count, '0') as order_count,
        coalesce(assets.asset_count, '0') as asset_count,
        brands.updated_at
      from brands
      left join (
        select user_id, brand_id, count(*)::text as logo_count
        from generated_logos
        where brand_id is not null
        group by user_id, brand_id
      ) logos on logos.user_id = brands.user_id and logos.brand_id = brands.id
      left join (
        select user_id, brand_id, count(*)::text as draft_count
        from business_card_drafts
        where brand_id is not null
        group by user_id, brand_id
      ) drafts on drafts.user_id = brands.user_id and drafts.brand_id = brands.id
      left join (
        select user_id, brand_id, count(*)::text as order_count
        from orders
        group by user_id, brand_id
      ) orders on orders.user_id = brands.user_id and orders.brand_id = brands.id
      left join (
        select user_id, brand_id, count(*)::text as asset_count
        from brand_assets
        group by user_id, brand_id
      ) assets on assets.user_id = brands.user_id and assets.brand_id = brands.id
      order by brands.updated_at desc, brands.created_at desc
      limit 1000
    `,
  );

  return result.rows.map(toBrand);
}

export async function listAdminBrandTransferData(): Promise<{ users: AdminBrandTransferUser[]; brands: AdminBrandTransferBrand[] }> {
  return withDbClient(async (client) => {
    const [usersResult, brands] = await Promise.all([
      client.query<UserRow>(
        `
          select id::text, name, contact, email
          from users
          order by updated_at desc, created_at desc
          limit 1000
        `,
      ),
      readBrandRows(client),
    ]);

    return { users: usersResult.rows.map(toUser), brands };
  });
}

async function countIdCollisions(client: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }, tableName: "generated_logos" | "business_card_drafts" | "orders" | "brand_assets", sourceUserId: string, targetUserId: string, brandId: string) {
  const result = await client.query<CountRow>(
    `
      select count(*)::text as count
      from ${tableName} target
      where target.user_id = $2
        and target.id in (
          select source.id
          from ${tableName} source
          where source.user_id = $1 and source.brand_id = $3
        )
    `,
    [sourceUserId, targetUserId, brandId],
  );

  return readCount(result.rows[0]?.count ?? "0");
}

export async function transferAdminBrand(input: { sourceUserId: string; targetUserId: string; brandId: string }): Promise<AdminBrandTransferResult> {
  const sourceUserId = input.sourceUserId.trim();
  const targetUserId = input.targetUserId.trim();
  const brandId = input.brandId.trim();

  if (!sourceUserId || !targetUserId || !brandId || sourceUserId === targetUserId) {
    throw new Error("Invalid brand transfer request.");
  }

  return withDbClient(async (client) => {
    await client.query("begin");

    try {
      const [sourceBrandResult, targetUserResult, targetBrandResult] = await Promise.all([
        client.query<{ name: string }>("select name from brands where user_id = $1 and id = $2 for update", [sourceUserId, brandId]),
        client.query<{ id: string }>("select id::text from users where id = $1 limit 1", [targetUserId]),
        client.query<{ id: string }>("select id from brands where user_id = $1 and id = $2 limit 1", [targetUserId, brandId]),
      ]);

      if (!sourceBrandResult.rows[0]) {
        throw new Error("Source brand not found.");
      }

      if (!targetUserResult.rows[0]) {
        throw new Error("Target user not found.");
      }

      if (targetBrandResult.rows[0]) {
        throw new Error("Target user already has this brand id.");
      }

      const [logoCollisions, draftCollisions, orderCollisions, assetCollisions] = await Promise.all([
        countIdCollisions(client, "generated_logos", sourceUserId, targetUserId, brandId),
        countIdCollisions(client, "business_card_drafts", sourceUserId, targetUserId, brandId),
        countIdCollisions(client, "orders", sourceUserId, targetUserId, brandId),
        countIdCollisions(client, "brand_assets", sourceUserId, targetUserId, brandId),
      ]);

      if (logoCollisions + draftCollisions + orderCollisions + assetCollisions > 0) {
        throw new Error("Target user has conflicting child ids.");
      }

      const logoResult = await client.query("update generated_logos set user_id = $2, updated_at = now() where user_id = $1 and brand_id = $3", [sourceUserId, targetUserId, brandId]);
      const draftResult = await client.query("update business_card_drafts set user_id = $2, updated_at = now() where user_id = $1 and brand_id = $3", [sourceUserId, targetUserId, brandId]);
      const orderResult = await client.query("update orders set user_id = $2, updated_at = now() where user_id = $1 and brand_id = $3", [sourceUserId, targetUserId, brandId]);
      const assetResult = await client.query("update brand_assets set user_id = $2, updated_at = now() where user_id = $1 and brand_id = $3", [sourceUserId, targetUserId, brandId]);

      await client.query("update brands set user_id = $2, updated_at = now() where user_id = $1 and id = $3", [sourceUserId, targetUserId, brandId]);
      await client.query("update users set updated_at = now() where id = $1 or id = $2", [sourceUserId, targetUserId]);

      const updatedBrandResult = await client.query<BrandRow>(
        `
          select
            brands.user_id::text,
            brands.id,
            brands.name,
            brands.category,
            brands.selected_logo_id,
            (select count(*)::text from generated_logos where user_id = brands.user_id and brand_id = brands.id) as logo_count,
            (select count(*)::text from business_card_drafts where user_id = brands.user_id and brand_id = brands.id) as draft_count,
            (select count(*)::text from orders where user_id = brands.user_id and brand_id = brands.id) as order_count,
            (select count(*)::text from brand_assets where user_id = brands.user_id and brand_id = brands.id) as asset_count,
            brands.updated_at
          from brands
          where brands.user_id = $1 and brands.id = $2
          limit 1
        `,
        [targetUserId, brandId],
      );
      const updatedBrand = updatedBrandResult.rows[0];

      if (!updatedBrand) {
        throw new Error("Transferred brand not found.");
      }

      await client.query("commit");

      return {
        brand: toBrand(updatedBrand),
        fromUserId: sourceUserId,
        toUserId: targetUserId,
        moved: {
          logos: logoResult.rowCount ?? 0,
          drafts: draftResult.rowCount ?? 0,
          orders: orderResult.rowCount ?? 0,
          assets: assetResult.rowCount ?? 0,
        },
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
