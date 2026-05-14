import "server-only";

import crypto from "node:crypto";
import type { PoolClient } from "pg";
import type { Brand, GeneratedLogoOption } from "@/lib/types";
import { isBrand } from "@/lib/brand-workspace";
import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import { withDbClient } from "@/lib/server/db";

export type PublicLogoShare = {
  token: string;
  brandName: string;
  category: string;
  designRequest: string;
  logo: GeneratedLogoOption;
  sharedAt?: string;
};

type ShareRow = {
  user_id: string;
  brand_id: string;
  brand_name: string;
  category: string;
  design_request: string;
  logo_id: string;
  payload: unknown;
};

const shareTokenPattern = /^[A-Za-z0-9_-]{24,80}$/;

function createShareToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function isLogoShareToken(value: string) {
  return shareTokenPattern.test(value);
}

function readSharedAt(logo: GeneratedLogoOption) {
  const value = (logo as { sharedAt?: unknown }).sharedAt;

  return typeof value === "string" ? value : undefined;
}

function toPublicLogoShare(row: ShareRow, token: string): PublicLogoShare | undefined {
  if (!isGeneratedLogoOption(row.payload)) {
    return undefined;
  }

  return {
    token,
    brandName: row.brand_name,
    category: row.category,
    designRequest: row.design_request,
    logo: row.payload,
    sharedAt: readSharedAt(row.payload),
  };
}

async function findShareWithClient(client: PoolClient, token: string, lock = false) {
  const result = await client.query<ShareRow>(
    `
      select g.user_id::text,
        g.brand_id,
        b.name as brand_name,
        b.category,
        b.design_request,
        g.id as logo_id,
        g.payload
      from generated_logos g
      join brands b on b.user_id = g.user_id and b.id = g.brand_id
      where g.payload->>'shareToken' = $1
        and g.payload->>'shareLockedAt' is null
      limit 1
      ${lock ? "for update of g" : ""}
    `,
    [token],
  );

  return result.rows[0];
}

export async function createLogoShare(userId: string, brandId: string, logoId: string) {
  return withDbClient(async (client) => {
    const result = await client.query<ShareRow>(
      `
        select g.user_id::text,
          g.brand_id,
          b.name as brand_name,
          b.category,
          b.design_request,
          g.id as logo_id,
          g.payload
        from generated_logos g
        join brands b on b.user_id = g.user_id and b.id = g.brand_id
        where g.user_id = $1
          and b.id = $2
          and g.id = $3
        limit 1
      `,
      [userId, brandId, logoId],
    );
    const row = result.rows[0];

    if (!row || !isGeneratedLogoOption(row.payload)) {
      return undefined;
    }

    const existingToken = (row.payload as { shareToken?: unknown; shareLockedAt?: unknown }).shareToken;

    if (typeof existingToken === "string" && isLogoShareToken(existingToken) && (row.payload as { shareLockedAt?: unknown }).shareLockedAt === undefined) {
      return toPublicLogoShare(row, existingToken);
    }

    const token = createShareToken();
    const sharedAt = new Date().toISOString();
    const updateResult = await client.query<ShareRow>(
      `
        update generated_logos
        set payload = payload || jsonb_build_object('shareToken', $4::text, 'sharedAt', $5::text),
          updated_at = now()
        where user_id = $1 and brand_id = $2 and id = $3
        returning user_id::text, brand_id, $6::text as brand_name, $7::text as category, $8::text as design_request, id as logo_id, payload
      `,
      [userId, brandId, logoId, token, sharedAt, row.brand_name, row.category, row.design_request],
    );

    return toPublicLogoShare(updateResult.rows[0], token);
  });
}

export async function readPublicLogoShare(token: string) {
  if (!isLogoShareToken(token)) {
    return undefined;
  }

  return withDbClient(async (client) => {
    const row = await findShareWithClient(client, token);

    return row ? toPublicLogoShare(row, token) : undefined;
  });
}

export async function claimLogoShare(token: string, userId: string, userName: string) {
  if (!isLogoShareToken(token)) {
    return undefined;
  }

  return withDbClient(async (client) => {
    await client.query("begin");

    try {
      const row = await findShareWithClient(client, token, true);

      if (!row || !isGeneratedLogoOption(row.payload)) {
        await client.query("rollback");
        return undefined;
      }

      const claimedAt = new Date().toISOString();
      const brandId = `brand-shared-${crypto.randomUUID()}`;
      const logoId = `logo-shared-${crypto.randomUUID()}`;
      const brandName = userName.trim() || row.brand_name;
      const { shareToken: _shareToken, sharedAt: _sharedAt, shareLockedAt: _shareLockedAt, shareClaimedByUserId: _shareClaimedByUserId, ...claimedLogoSource } = row.payload as GeneratedLogoOption & {
        shareToken?: string;
        sharedAt?: string;
        shareLockedAt?: string;
        shareClaimedByUserId?: string;
      };
      const brand: Brand = {
        id: brandId,
        name: brandName,
        category: row.category,
        designRequest: row.design_request,
        selectedLogoId: logoId,
        logoIds: [logoId],
        members: [],
        createdAt: "방금 생성",
        assets: 1,
      };
      const logo: GeneratedLogoOption = {
        ...claimedLogoSource,
        id: logoId,
        name: `${brandName} 공유 로고`,
      };

      if (!isBrand(brand)) {
        throw new Error("Invalid claimed brand payload.");
      }

      await client.query(
        `
          insert into brands (user_id, id, name, category, design_request, selected_logo_id, members, assets, created_label)
          values ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7, $8)
        `,
        [userId, brand.id, brand.name, brand.category, brand.designRequest, brand.selectedLogoId, brand.assets, brand.createdAt],
      );
      await client.query(
        `
          insert into generated_logos (user_id, id, brand_id, payload)
          values ($1, $2, $3, $4::jsonb)
        `,
        [userId, logo.id, brand.id, JSON.stringify(logo)],
      );
      await client.query(
        `
          update generated_logos
          set payload = payload || jsonb_build_object('shareLockedAt', $4::text, 'shareClaimedByUserId', $5::text),
            updated_at = now()
          where user_id = $1 and brand_id = $2 and id = $3
        `,
        [row.user_id, row.brand_id, row.logo_id, claimedAt, userId],
      );
      await client.query("commit");

      return { brand, logo };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
