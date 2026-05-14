import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import { normalizeMemberContact } from "@/lib/member-contact";
import { logoOptions } from "@/lib/mock-data";
import type { Brand, BrandAsset, BusinessCardDraft, GeneratedLogoOption, Member, OrderRecord, PaymentMethod } from "@/lib/types";

export type BrandWorkspace = {
  brands: Brand[];
  savedGeneratedLogoOptions: GeneratedLogoOption[];
  businessCardDrafts: BusinessCardDraft[];
  orders: OrderRecord[];
  brandAssets: BrandAsset[];
};

const paymentMethods = new Set<PaymentMethod>(["간편결제", "카드", "계좌이체"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isMember(value: unknown): value is Member {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.id) && isString(value.name) && isString(value.role) && isString(value.phone) && (value.mainPhone === undefined || isString(value.mainPhone)) && (value.fax === undefined || isString(value.fax)) && (value.email === undefined || isString(value.email)) && (value.website === undefined || isString(value.website)) && (value.address === undefined || isString(value.address));
}

function normalizeBrandContacts(brand: Brand): Brand {
  return { ...brand, members: brand.members.map(normalizeMemberContact) };
}

function normalizeBusinessCardDraftContacts(draft: BusinessCardDraft): BusinessCardDraft {
  return { ...draft, member: normalizeMemberContact(draft.member) };
}

export function isBrand(value: unknown): value is Brand {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isString(value.name) &&
    isString(value.category) &&
    isString(value.designRequest) &&
    isString(value.selectedLogoId) &&
    (value.logoIds === undefined || (Array.isArray(value.logoIds) && value.logoIds.every(isString))) &&
    Array.isArray(value.members) &&
    value.members.every(isMember) &&
    isString(value.createdAt) &&
    typeof value.assets === "number" &&
    Number.isFinite(value.assets)
  );
}

export function isBusinessCardDraft(value: unknown): value is BusinessCardDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    (value.brandId === undefined || isString(value.brandId)) &&
    isString(value.brandName) &&
    isString(value.category) &&
    isString(value.designRequest) &&
    isString(value.selectedLogoId) &&
    (value.templateId === undefined || isString(value.templateId)) &&
    isMember(value.member) &&
    isString(value.createdAt)
  );
}

export function isOrderRecord(value: unknown): value is OrderRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isString(value.orderNumber) &&
    isString(value.title) &&
    (value.status === "paid" || value.status === "preparing") &&
    isString(value.statusLabel) &&
    isString(value.price) &&
    isString(value.quantity) &&
    isString(value.paper) &&
    isString(value.paymentMethod) &&
    paymentMethods.has(value.paymentMethod as PaymentMethod) &&
    isString(value.createdAt) &&
    isString(value.brandId) &&
    isString(value.cardDraftId) &&
    (value.templateId === undefined || isString(value.templateId))
  );
}

export function isBrandAsset(value: unknown): value is BrandAsset {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isString(value.brandId) &&
    isString(value.sectionId) &&
    isString(value.productId) &&
    isString(value.title) &&
    isString(value.description) &&
    (value.imageUrl === undefined || isString(value.imageUrl)) &&
    (value.assetType === undefined || value.assetType === "mockup" || value.assetType === "brand-board" || value.assetType === "file") &&
    isString(value.createdAt)
  );
}

function hasUniqueIds(items: { id: string }[]) {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function createAllowedSelectedLogoIds(savedGeneratedLogoOptions: GeneratedLogoOption[]) {
  return new Set([...logoOptions.map((option) => option.id), ...savedGeneratedLogoOptions.map((option) => option.id)]);
}

export function readBrandWorkspace(value: unknown): BrandWorkspace | undefined {
  if (!isRecord(value) || !Array.isArray(value.brands) || !Array.isArray(value.savedGeneratedLogoOptions) || !Array.isArray(value.businessCardDrafts) || !Array.isArray(value.orders)) {
    return undefined;
  }

  const brands = value.brands.filter(isBrand).map((brand) => normalizeBrandContacts({
    ...brand,
    logoIds: Array.from(new Set([brand.selectedLogoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : [])])),
  }));
  const savedGeneratedLogoOptions = value.savedGeneratedLogoOptions.filter(isGeneratedLogoOption);
  const businessCardDrafts = value.businessCardDrafts.filter(isBusinessCardDraft).map(normalizeBusinessCardDraftContacts);
  const orders = value.orders.filter(isOrderRecord);
  const rawBrandAssets = Array.isArray(value.brandAssets) ? value.brandAssets : [];
  const brandAssets = rawBrandAssets.filter(isBrandAsset);

  if (brands.length !== value.brands.length || savedGeneratedLogoOptions.length !== value.savedGeneratedLogoOptions.length || businessCardDrafts.length !== value.businessCardDrafts.length || orders.length !== value.orders.length || brandAssets.length !== rawBrandAssets.length) {
    return undefined;
  }

  if (!hasUniqueIds(brands) || !hasUniqueIds(savedGeneratedLogoOptions) || !hasUniqueIds(businessCardDrafts) || !hasUniqueIds(orders) || !hasUniqueIds(brandAssets)) {
    return undefined;
  }

  const allowedSelectedLogoIds = createAllowedSelectedLogoIds(savedGeneratedLogoOptions);

  if (brands.some((brand) => !allowedSelectedLogoIds.has(brand.selectedLogoId) || brand.logoIds.some((logoId) => !allowedSelectedLogoIds.has(logoId))) || businessCardDrafts.some((draft) => !allowedSelectedLogoIds.has(draft.selectedLogoId))) {
    return undefined;
  }

  return { brands, savedGeneratedLogoOptions, businessCardDrafts, orders, brandAssets };
}

function mergeById<T extends { id: string }>(localItems: T[], serverItems: T[]) {
  const merged = new Map<string, T>();

  for (const item of serverItems) {
    merged.set(item.id, item);
  }

  for (const item of localItems) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

function mergeByIdWithServerPriority<T extends { id: string }>(localItems: T[], serverItems: T[]) {
  const merged = new Map<string, T>();

  for (const item of localItems) {
    merged.set(item.id, item);
  }

  for (const item of serverItems) {
    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

export function mergeBrandWorkspaces(localWorkspace: BrandWorkspace, serverWorkspace: BrandWorkspace): BrandWorkspace {
  return {
    brands: mergeByIdWithServerPriority(localWorkspace.brands, serverWorkspace.brands),
    savedGeneratedLogoOptions: mergeById(localWorkspace.savedGeneratedLogoOptions, serverWorkspace.savedGeneratedLogoOptions),
    businessCardDrafts: mergeById(localWorkspace.businessCardDrafts, serverWorkspace.businessCardDrafts),
    orders: mergeById(localWorkspace.orders, serverWorkspace.orders),
    brandAssets: mergeById(localWorkspace.brandAssets, serverWorkspace.brandAssets),
  };
}

export function hasBrandWorkspaceData(workspace: BrandWorkspace) {
  return workspace.brands.length > 0 || workspace.savedGeneratedLogoOptions.length > 0 || workspace.businessCardDrafts.length > 0 || workspace.orders.length > 0 || workspace.brandAssets.length > 0;
}

export function createBrandWorkspaceSignature(workspace: BrandWorkspace) {
  return JSON.stringify(workspace);
}
