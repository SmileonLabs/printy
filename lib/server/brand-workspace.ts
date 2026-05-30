import "server-only";

import type { PoolClient } from "pg";
import type { Brand, BrandAsset, BusinessCardDraft, GeneratedLogoOption, OrderRecord, PrintProductDraft } from "@/lib/types";
import { logoOptions } from "@/lib/mock-data";
import { hasBrandWorkspaceData, isBrand, isBrandAsset, isBusinessCardDraft, isOrderRecord, isPrintProductDraft, readBrandWorkspace, readBrandWorkspacePatch, type BrandWorkspace, type BrandWorkspacePatch } from "@/lib/brand-workspace";
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

let printProductDraftStorageReady = false;

async function ensurePrintProductDraftStorage(client: PoolClient) {
  if (printProductDraftStorageReady) {
    return;
  }

  await client.query(`
    create table if not exists print_product_drafts (
      user_id text not null,
      id text not null,
      brand_id text,
      product_type text not null,
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key (user_id, id)
    )
  `);
  await client.query("create index if not exists print_product_drafts_user_brand_id_idx on print_product_drafts (user_id, brand_id)");
  await client.query("create index if not exists print_product_drafts_user_updated_at_idx on print_product_drafts (user_id, updated_at desc)");
  printProductDraftStorageReady = true;
}

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

function toPrintProductDraft(row: PayloadRow): PrintProductDraft | undefined {
  return isPrintProductDraft(row.payload) ? row.payload : undefined;
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

function recoverBrandsFromBusinessCardDrafts(workspace: BrandWorkspace): BrandWorkspace {
  if (workspace.brands.length > 0 || workspace.businessCardDrafts.length === 0) {
    return workspace;
  }

  const brandsById = new Map<string, Brand>();

  for (const draft of workspace.businessCardDrafts) {
    const brandId = draft.brandId ?? `recovered-brand-${draft.id}`;
    const existingBrand = brandsById.get(brandId);
    const memberExists = existingBrand?.members.some((member) => member.id === draft.member.id) ?? false;

    if (existingBrand) {
      brandsById.set(brandId, {
        ...existingBrand,
        logoIds: Array.from(new Set([...existingBrand.logoIds, draft.selectedLogoId])),
        members: memberExists ? existingBrand.members : [...existingBrand.members, draft.member],
      });
      continue;
    }

    brandsById.set(brandId, {
      id: brandId,
      name: draft.brandName,
      category: draft.category,
      designRequest: draft.designRequest,
      selectedLogoId: draft.selectedLogoId,
      logoIds: [draft.selectedLogoId],
      members: [draft.member],
      createdAt: draft.createdAt,
      assets: 4,
    });
  }

  return { ...workspace, brands: Array.from(brandsById.values()) };
}

function getBrandIdForLogo(logo: GeneratedLogoOption, brands: Brand[]) {
  return brands.find((brand) => brand.selectedLogoId === logo.id || (Array.isArray(brand.logoIds) && brand.logoIds.includes(logo.id)))?.id;
}

async function loadBrandWorkspaceWithClient(client: PoolClient, userId: string): Promise<BrandWorkspace> {
  await ensurePrintProductDraftStorage(client);

  const [brandResult, logoResult, draftResult, printProductDraftResult, orderResult, assetResult] = await Promise.all([
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
        from print_product_drafts
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
    printProductDrafts: printProductDraftResult.rows.map(toPrintProductDraft).filter((draft): draft is PrintProductDraft => draft !== undefined),
    orders: orderResult.rows.map(toOrder).filter((order): order is OrderRecord => order !== undefined),
    brandAssets: assetResult.rows.map(toBrandAsset).filter((asset): asset is BrandAsset => asset !== undefined),
  };

  return reconcileSelectedLogoIds(recoverBrandsFromBusinessCardDrafts(workspace));
}

export async function loadBrandWorkspace(userId: string) {
  return withDbClient((client) => loadBrandWorkspaceWithClient(client, userId));
}

export async function savePrintProductDraftPatch(userId: string, draft: PrintProductDraft, assets: BrandAsset[] = []) {
  if (!isPrintProductDraft(draft) || assets.some((asset) => !isBrandAsset(asset) || asset.brandId !== draft.brandId)) {
    throw new Error("Invalid print product draft patch payload.");
  }

  return withDbClient(async (client) => {
    await ensurePrintProductDraftStorage(client);
    await client.query("begin");

    try {
      await client.query(
        `
          insert into print_product_drafts (user_id, id, brand_id, product_type, payload)
          values ($1, $2, $3, $4, $5::jsonb)
          on conflict (user_id, id)
          do update set
            brand_id = excluded.brand_id,
            product_type = excluded.product_type,
            payload = excluded.payload,
            updated_at = now()
        `,
        [userId, draft.id, draft.brandId, draft.productType, JSON.stringify(draft)],
      );

      for (const asset of assets) {
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

      if (assets.length > 0) {
        await client.query(
          `
            update brands
            set assets = greatest(assets, (select count(*)::int from brand_assets where user_id = $1 and brand_id = $2)),
              updated_at = now()
            where user_id = $1 and id = $2
          `,
          [userId, draft.brandId],
        );
      }

      await client.query("commit");

      return { draft, assets };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function saveBrandWorkspace(userId: string, workspace: BrandWorkspace) {
  const validWorkspace = readBrandWorkspace(workspace);

  if (!validWorkspace) {
    throw new Error("Invalid brand workspace payload.");
  }

  return withDbClient(async (client) => {
    await ensurePrintProductDraftStorage(client);
    const currentWorkspace = await loadBrandWorkspaceWithClient(client, userId);

    if (!hasBrandWorkspaceData(validWorkspace) && hasBrandWorkspaceData(currentWorkspace)) {
      return currentWorkspace;
    }

    if (validWorkspace.brands.length === 0 && currentWorkspace.brands.length > 0) {
      return currentWorkspace;
    }

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
      await client.query("delete from print_product_drafts where user_id = $1 and not (id = any($2::text[]))", [userId, validWorkspace.printProductDrafts.map((draft) => draft.id)]);
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
              payload = case
                when generated_logos.payload ? 'vectorSvgUrl' and not (excluded.payload ? 'vectorSvgUrl')
                  then excluded.payload || jsonb_build_object('vectorSvgUrl', generated_logos.payload->>'vectorSvgUrl')
                else excluded.payload
              end,
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

      for (const draft of validWorkspace.printProductDrafts) {
        await client.query(
          `
            insert into print_product_drafts (user_id, id, brand_id, product_type, payload)
            values ($1, $2, $3, $4, $5::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              product_type = excluded.product_type,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, draft.id, draft.brandId, draft.productType, JSON.stringify(draft)],
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

export async function saveBrandWorkspacePatch(userId: string, patch: BrandWorkspacePatch) {
  const validPatch = readBrandWorkspacePatch(patch);

  if (!validPatch) {
    throw new Error("Invalid brand workspace patch payload.");
  }

  return withDbClient(async (client) => {
    await ensurePrintProductDraftStorage(client);
    await client.query("begin");

    try {
      if (validPatch.savedGeneratedLogoOptions) {
        await assertGeneratedLogoStorageAvailableForPublicUrls(
          validPatch.savedGeneratedLogoOptions.map((logo) => logo.imageUrl),
          client,
        );
      }

      for (const brand of validPatch.brands ?? []) {
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

      for (const logo of validPatch.savedGeneratedLogoOptions ?? []) {
        await client.query(
          `
            insert into generated_logos (user_id, id, brand_id, payload)
            values ($1, $2, $3, $4::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              payload = case
                when generated_logos.payload ? 'vectorSvgUrl' and not (excluded.payload ? 'vectorSvgUrl')
                  then excluded.payload || jsonb_build_object('vectorSvgUrl', generated_logos.payload->>'vectorSvgUrl')
                else excluded.payload
              end,
              updated_at = now()
          `,
          [userId, logo.id, null, JSON.stringify(logo)],
        );
      }

      for (const draft of validPatch.businessCardDrafts ?? []) {
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

      for (const draft of validPatch.printProductDrafts ?? []) {
        await client.query(
          `
            insert into print_product_drafts (user_id, id, brand_id, product_type, payload)
            values ($1, $2, $3, $4, $5::jsonb)
            on conflict (user_id, id)
            do update set
              brand_id = excluded.brand_id,
              product_type = excluded.product_type,
              payload = excluded.payload,
              updated_at = now()
          `,
          [userId, draft.id, draft.brandId, draft.productType, JSON.stringify(draft)],
        );
      }

      for (const order of validPatch.orders ?? []) {
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

      for (const asset of validPatch.brandAssets ?? []) {
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

      await client.query("commit");

      return { ok: true };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}
