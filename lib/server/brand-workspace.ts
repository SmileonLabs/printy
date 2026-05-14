import "server-only";

import type { PoolClient } from "pg";
import type { Brand, BrandAsset, BusinessCardDraft, GeneratedLogoOption, OrderRecord } from "@/lib/types";
import { logoOptions } from "@/lib/mock-data";
import { isBrand, isBrandAsset, isBusinessCardDraft, isOrderRecord, readBrandWorkspace, type BrandWorkspace } from "@/lib/brand-workspace";
import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import { withDbClient } from "@/lib/server/db";
import { assertGeneratedLogoStorageAvailableForPublicUrls, cleanupUnreferencedGeneratedLogoFiles, isGeneratedLogoPublicUrl } from "@/lib/server/storage";

type BrandRow = {
  id: string;
  name: string;
  category: string;
  design_request: string;
  selected_logo_id: string;
  members: unknown;
  assets: number;
  created_label: string;
};

type PayloadRow = {
  payload: unknown;
};

type LogoPayloadRow = PayloadRow & {
  brand_id: string | null;
};

type ImageUrlRow = {
  image_url: string | null;
};

function toBrand(row: BrandRow, logoIds: string[]): Brand | undefined {
  const brand = {
    id: row.id,
    name: row.name,
    category: row.category,
    designRequest: row.design_request,
    selectedLogoId: row.selected_logo_id,
    logoIds,
    members: row.members,
    createdAt: row.created_label,
    assets: row.assets,
  };

  return isBrand(brand) ? brand : undefined;
}

function toGeneratedLogo(row: PayloadRow): GeneratedLogoOption | undefined {
  return isGeneratedLogoOption(row.payload) ? row.payload : undefined;
}

function toBusinessCardDraft(row: PayloadRow): BusinessCardDraft | undefined {
  return isBusinessCardDraft(row.payload) ? row.payload : undefined;
}

function toOrder(row: PayloadRow): OrderRecord | undefined {
  return isOrderRecord(row.payload) ? row.payload : undefined;
}

function toBrandAsset(row: PayloadRow): BrandAsset | undefined {
  return isBrandAsset(row.payload) ? row.payload : undefined;
}

function isSelectableLogoId(logoId: string, savedGeneratedLogoOptions: GeneratedLogoOption[]) {
  return logoOptions.some((option) => option.id === logoId) || savedGeneratedLogoOptions.some((option) => option.id === logoId);
}

function normalizeSelectedLogoId(logoId: string, savedGeneratedLogoOptions: GeneratedLogoOption[]) {
  if (isSelectableLogoId(logoId, savedGeneratedLogoOptions)) {
    return logoId;
  }

  return logoOptions[0].id;
}

function reconcileSelectedLogoIds(workspace: BrandWorkspace): BrandWorkspace {
  return {
    ...workspace,
    brands: workspace.brands.map((brand) => ({
      ...brand,
      selectedLogoId: normalizeSelectedLogoId(brand.selectedLogoId, workspace.savedGeneratedLogoOptions),
      logoIds: Array.from(new Set([normalizeSelectedLogoId(brand.selectedLogoId, workspace.savedGeneratedLogoOptions), ...(Array.isArray(brand.logoIds) ? brand.logoIds : []).filter((logoId) => isSelectableLogoId(logoId, workspace.savedGeneratedLogoOptions))])),
    })),
    businessCardDrafts: workspace.businessCardDrafts.map((draft) => ({
      ...draft,
      selectedLogoId: normalizeSelectedLogoId(draft.selectedLogoId, workspace.savedGeneratedLogoOptions),
    })),
  };
}

function getBrandIdForLogo(logo: GeneratedLogoOption, brands: Brand[]) {
  return brands.find((brand) => brand.selectedLogoId === logo.id || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logo.id)))?.id;
}

async function loadBrandWorkspaceWithClient(client: PoolClient, userId: string): Promise<BrandWorkspace> {
  const [brandResult, logoResult, draftResult, orderResult, assetResult] = await Promise.all([
    client.query<BrandRow>(
      `
        select id, name, category, design_request, selected_logo_id, members, assets, created_label
        from brands
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    ),
    client.query<LogoPayloadRow>(
      `
        select brand_id, payload
        from generated_logos
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    ),
    client.query<PayloadRow>(
      `
        select payload
        from business_card_drafts
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    ),
    client.query<PayloadRow>(
      `
        select payload
        from orders
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    ),
    client.query<PayloadRow>(
      `
        select payload
        from brand_assets
        where user_id = $1
        order by updated_at desc, created_at desc
      `,
      [userId],
    ),
  ]);

  const savedGeneratedLogoOptions = logoResult.rows.map(toGeneratedLogo).filter((logo): logo is GeneratedLogoOption => logo !== undefined);
  const logoIdsByBrandId = new Map<string, string[]>();

  logoResult.rows.forEach((row) => {
    const logo = toGeneratedLogo(row);

    if (!logo || !row.brand_id) {
      return;
    }

    logoIdsByBrandId.set(row.brand_id, [...(logoIdsByBrandId.get(row.brand_id) ?? []), logo.id]);
  });

  const workspace = {
    brands: brandResult.rows.map((row) => toBrand(row, logoIdsByBrandId.get(row.id) ?? [])).filter((brand): brand is Brand => brand !== undefined),
    savedGeneratedLogoOptions,
    businessCardDrafts: draftResult.rows.map(toBusinessCardDraft).filter((draft): draft is BusinessCardDraft => draft !== undefined),
    orders: orderResult.rows.map(toOrder).filter((order): order is OrderRecord => order !== undefined),
    brandAssets: assetResult.rows.map(toBrandAsset).filter((asset): asset is BrandAsset => asset !== undefined),
  };

  return reconcileSelectedLogoIds(workspace);
}

export async function loadBrandWorkspace(userId: string) {
  return withDbClient((client) => loadBrandWorkspaceWithClient(client, userId));
}

export async function saveBrandWorkspace(userId: string, workspace: BrandWorkspace) {
  const validWorkspace = readBrandWorkspace(workspace);

  if (!validWorkspace) {
    throw new Error("Invalid brand workspace payload.");
  }

  return withDbClient(async (client) => {
    let prunedGeneratedLogoPublicUrls: string[] = [];

    await client.query("begin");

    try {
      const brandIds = validWorkspace.brands.map((brand) => brand.id);
      const logoIds = validWorkspace.savedGeneratedLogoOptions.map((logo) => logo.id);
      const draftIds = validWorkspace.businessCardDrafts.map((draft) => draft.id);
      const orderIds = validWorkspace.orders.map((order) => order.id);
      const assetIds = validWorkspace.brandAssets.map((asset) => asset.id);
      await assertGeneratedLogoStorageAvailableForPublicUrls(
        validWorkspace.savedGeneratedLogoOptions.map((logo) => logo.imageUrl),
        client,
      );

      const prunedLogoResult = await client.query<ImageUrlRow>(
        `
          select payload->>'imageUrl' as image_url
          from generated_logos
          where user_id = $1 and not (id = any($2::text[]))
        `,
        [userId, logoIds],
      );
      prunedGeneratedLogoPublicUrls = Array.from(
        new Set(
          prunedLogoResult.rows
            .map((row) => row.image_url)
            .filter((imageUrl): imageUrl is string => imageUrl !== null && isGeneratedLogoPublicUrl(imageUrl)),
        ),
      );

      await client.query("delete from brands where user_id = $1 and not (id = any($2::text[]))", [userId, brandIds]);
      await client.query("delete from generated_logos where user_id = $1 and not (id = any($2::text[]))", [userId, logoIds]);
      await client.query("delete from business_card_drafts where user_id = $1 and not (id = any($2::text[]))", [userId, draftIds]);
      await client.query("delete from orders where user_id = $1 and not (id = any($2::text[]))", [userId, orderIds]);
      await client.query("delete from brand_assets where user_id = $1 and not (id = any($2::text[]))", [userId, assetIds]);

      for (const brand of validWorkspace.brands) {
        await client.query(
          `
            insert into brands (user_id, id, name, category, design_request, selected_logo_id, members, assets, created_label)
            values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
            on conflict (user_id, id)
            do update set
              name = excluded.name,
              category = excluded.category,
              design_request = excluded.design_request,
              selected_logo_id = excluded.selected_logo_id,
              members = excluded.members,
              assets = excluded.assets,
              created_label = excluded.created_label,
              updated_at = now()
          `,
          [userId, brand.id, brand.name, brand.category, brand.designRequest, brand.selectedLogoId, JSON.stringify(brand.members), brand.assets, brand.createdAt],
        );
      }

      for (const logo of validWorkspace.savedGeneratedLogoOptions) {
        await client.query(
          `
            insert into generated_logos (user_id, id, brand_id, payload)
            values ($1, $2, $3, $4::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, logo.id, getBrandIdForLogo(logo, validWorkspace.brands) ?? null, JSON.stringify(logo)],
        );
      }

      for (const draft of validWorkspace.businessCardDrafts) {
        await client.query(
          `
            insert into business_card_drafts (user_id, id, brand_id, payload)
            values ($1, $2, $3, $4::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, draft.id, draft.brandId ?? null, JSON.stringify(draft)],
        );
      }

      for (const order of validWorkspace.orders) {
        await client.query(
          `
            insert into orders (user_id, id, brand_id, card_draft_id, template_id, payload)
            values ($1, $2, $3, $4, $5, $6::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              card_draft_id = excluded.card_draft_id,
              template_id = excluded.template_id,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, order.id, order.brandId, order.cardDraftId, order.templateId ?? null, JSON.stringify(order)],
        );
      }

      for (const asset of validWorkspace.brandAssets) {
        await client.query(
          `
            insert into brand_assets (user_id, id, brand_id, section_id, product_id, payload)
            values ($1, $2, $3, $4, $5, $6::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              section_id = excluded.section_id,
              product_id = excluded.product_id,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, asset.id, asset.brandId, asset.sectionId, asset.productId, JSON.stringify(asset)],
        );
      }

      const savedWorkspace = await loadBrandWorkspaceWithClient(client, userId);

      await client.query("commit");

      if (prunedGeneratedLogoPublicUrls.length > 0) {
        try {
          await cleanupUnreferencedGeneratedLogoFiles(prunedGeneratedLogoPublicUrls);
        } catch (error) {
          console.error("Generated logo cleanup failed after workspace save.", error instanceof Error ? error.message : "Unknown error");
        }
      }

      return savedWorkspace;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
