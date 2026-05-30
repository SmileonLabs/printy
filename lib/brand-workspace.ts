import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import { normalizeMemberContact } from "@/lib/member-contact";
import { logoOptions } from "@/lib/mock-data";
import { isOrderStatus } from "@/lib/order-status";
import type { Brand, BrandAsset, BusinessCardDraft, GeneratedLogoOption, Member, OrderRecord, PaymentMethod, PrintProductDraft, ShippingInfo } from "@/lib/types";
import { normalizeBusinessCardTemplateLayout } from "@/lib/business-card-templates";

export type BrandWorkspace = {
  brands: Brand[];
  savedGeneratedLogoOptions: GeneratedLogoOption[];
  businessCardDrafts: BusinessCardDraft[];
  printProductDrafts: PrintProductDraft[];
  orders: OrderRecord[];
  brandAssets: BrandAsset[];
};

export type BrandWorkspacePatch = Partial<BrandWorkspace>;

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

function isShippingInfo(value: unknown): value is ShippingInfo {
  if (!isRecord(value)) {
    return false;
  }

  return isString(value.recipientName) && isString(value.recipientPhone) && isString(value.address) && isString(value.memo);
}

export function isMember(value: unknown): value is Member {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.id) && isString(value.name) && isString(value.role) && isString(value.phone) && (value.mainPhone === undefined || isString(value.mainPhone)) && (value.fax === undefined || isString(value.fax)) && (value.email === undefined || isString(value.email)) && (value.website === undefined || isString(value.website)) && (value.address === undefined || isString(value.address)) && (value.account === undefined || isString(value.account)) && (value.instagram === undefined || isString(value.instagram)) && (value.qrCodeImageUrl === undefined || isString(value.qrCodeImageUrl));
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
    (value.layout === undefined || Boolean(normalizeBusinessCardTemplateLayout(value.layout))) &&
    (value.completedMockupSignature === undefined || isString(value.completedMockupSignature)) &&
    (value.completedMockupAt === undefined || isString(value.completedMockupAt)) &&
    isMember(value.member) &&
    isString(value.createdAt)
  );
}

export function isPrintProductDraft(value: unknown): value is PrintProductDraft {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.id) && isString(value.brandId) && (value.productType === "banner" || value.productType === "signage" || value.productType === "flyer") && isString(value.title) && isString(value.request) && isRecord(value.layout) && Array.isArray(value.mockups) && isString(value.createdAt) && isString(value.updatedAt);
}

export function isOrderRecord(value: unknown): value is OrderRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isString(value.orderNumber) &&
    isString(value.title) &&
    isOrderStatus(value.status) &&
    isString(value.statusLabel) &&
    isString(value.price) &&
    isString(value.quantity) &&
    isString(value.paper) &&
    isString(value.paymentMethod) &&
    paymentMethods.has(value.paymentMethod as PaymentMethod) &&
    isString(value.createdAt) &&
    isString(value.brandId) &&
    isString(value.cardDraftId) &&
    (value.templateId === undefined || isString(value.templateId)) &&
    (value.shippingInfo === undefined || isShippingInfo(value.shippingInfo))
  );
}

export function isBrandAsset(value: unknown): value is BrandAsset {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isString(value.brandId) &&
    (value.logoId === undefined || isString(value.logoId)) &&
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
  const rawPrintProductDrafts = Array.isArray(value.printProductDrafts) ? value.printProductDrafts : [];
  const printProductDrafts = rawPrintProductDrafts.filter(isPrintProductDraft);
  const orders = value.orders.filter(isOrderRecord);
  const rawBrandAssets = Array.isArray(value.brandAssets) ? value.brandAssets : [];
  const brandAssets = rawBrandAssets.filter(isBrandAsset);

  if (brands.length !== value.brands.length || savedGeneratedLogoOptions.length !== value.savedGeneratedLogoOptions.length || businessCardDrafts.length !== value.businessCardDrafts.length || printProductDrafts.length !== rawPrintProductDrafts.length || orders.length !== value.orders.length || brandAssets.length !== rawBrandAssets.length) {
    return undefined;
  }

  if (!hasUniqueIds(brands) || !hasUniqueIds(savedGeneratedLogoOptions) || !hasUniqueIds(businessCardDrafts) || !hasUniqueIds(printProductDrafts) || !hasUniqueIds(orders) || !hasUniqueIds(brandAssets)) {
    return undefined;
  }

  const allowedSelectedLogoIds = createAllowedSelectedLogoIds(savedGeneratedLogoOptions);

  if (brands.some((brand) => !allowedSelectedLogoIds.has(brand.selectedLogoId) || brand.logoIds.some((logoId) => !allowedSelectedLogoIds.has(logoId))) || businessCardDrafts.some((draft) => !allowedSelectedLogoIds.has(draft.selectedLogoId))) {
    return undefined;
  }

  return { brands, savedGeneratedLogoOptions, businessCardDrafts, printProductDrafts, orders, brandAssets };
}

function hasUniqueIdsInOptionalArray<T extends { id: string }>(items: T[] | undefined) {
  if (!items) {
    return true;
  }

  return hasUniqueIds(items);
}

export function readBrandWorkspacePatch(value: unknown): BrandWorkspacePatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const rawBrands = Array.isArray(value.brands) ? value.brands : undefined;
  const rawGeneratedLogos = Array.isArray(value.savedGeneratedLogoOptions) ? value.savedGeneratedLogoOptions : undefined;
  const rawBusinessCardDrafts = Array.isArray(value.businessCardDrafts) ? value.businessCardDrafts : undefined;
  const rawPrintProductDrafts = Array.isArray(value.printProductDrafts) ? value.printProductDrafts : undefined;
  const rawOrders = Array.isArray(value.orders) ? value.orders : undefined;
  const rawBrandAssets = Array.isArray(value.brandAssets) ? value.brandAssets : undefined;

  const savedGeneratedLogoOptions = rawGeneratedLogos?.filter(isGeneratedLogoOption);
  if (rawGeneratedLogos && (!savedGeneratedLogoOptions || savedGeneratedLogoOptions.length !== rawGeneratedLogos.length)) {
    return undefined;
  }

  const allowedSelectedLogoIds = createAllowedSelectedLogoIds(savedGeneratedLogoOptions ?? []);

  const brands = rawBrands?.filter(isBrand).map((brand) => normalizeBrandContacts({
    ...brand,
    logoIds: Array.from(new Set([brand.selectedLogoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : [])])),
  }));
  if (rawBrands && (!brands || brands.length !== rawBrands.length)) {
    return undefined;
  }
  if (brands && brands.some((brand) => !allowedSelectedLogoIds.has(brand.selectedLogoId) || brand.logoIds.some((logoId) => !allowedSelectedLogoIds.has(logoId)))) {
    return undefined;
  }

  const businessCardDrafts = rawBusinessCardDrafts?.filter(isBusinessCardDraft).map(normalizeBusinessCardDraftContacts);
  if (rawBusinessCardDrafts && (!businessCardDrafts || businessCardDrafts.length !== rawBusinessCardDrafts.length)) {
    return undefined;
  }
  if (businessCardDrafts && businessCardDrafts.some((draft) => !allowedSelectedLogoIds.has(draft.selectedLogoId))) {
    return undefined;
  }

  const printProductDrafts = rawPrintProductDrafts?.filter(isPrintProductDraft);
  if (rawPrintProductDrafts && (!printProductDrafts || printProductDrafts.length !== rawPrintProductDrafts.length)) {
    return undefined;
  }

  const orders = rawOrders?.filter(isOrderRecord);
  if (rawOrders && (!orders || orders.length !== rawOrders.length)) {
    return undefined;
  }

  const brandAssets = rawBrandAssets?.filter(isBrandAsset);
  if (rawBrandAssets && (!brandAssets || brandAssets.length !== rawBrandAssets.length)) {
    return undefined;
  }

  if (!hasUniqueIdsInOptionalArray(brands) || !hasUniqueIdsInOptionalArray(savedGeneratedLogoOptions) || !hasUniqueIdsInOptionalArray(businessCardDrafts) || !hasUniqueIdsInOptionalArray(printProductDrafts) || !hasUniqueIdsInOptionalArray(orders) || !hasUniqueIdsInOptionalArray(brandAssets)) {
    return undefined;
  }

  return {
    brands,
    savedGeneratedLogoOptions,
    businessCardDrafts,
    printProductDrafts,
    orders,
    brandAssets,
  };
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

function mergeBusinessCardDrafts(localDrafts: BusinessCardDraft[], serverDrafts: BusinessCardDraft[]) {
  const merged = new Map<string, BusinessCardDraft>();

  for (const draft of serverDrafts) {
    merged.set(draft.id, draft);
  }

  for (const localDraft of localDrafts) {
    const serverDraft = merged.get(localDraft.id);

    merged.set(localDraft.id, serverDraft?.completedMockupSignature && !localDraft.completedMockupSignature
      ? {
          ...localDraft,
          completedMockupSignature: serverDraft.completedMockupSignature,
          completedMockup: serverDraft.completedMockup,
          completedMockupAt: serverDraft.completedMockupAt,
        }
      : localDraft);
  }

  return Array.from(merged.values());
}

function mergeGeneratedLogos(localLogos: GeneratedLogoOption[], serverLogos: GeneratedLogoOption[]) {
  const merged = new Map<string, GeneratedLogoOption>();

  for (const logo of serverLogos) {
    merged.set(logo.id, logo);
  }

  for (const localLogo of localLogos) {
    const serverLogo = merged.get(localLogo.id);

    merged.set(localLogo.id, serverLogo?.vectorSvgUrl && !localLogo.vectorSvgUrl ? { ...localLogo, vectorSvgUrl: serverLogo.vectorSvgUrl } : localLogo);
  }

  return Array.from(merged.values());
}

function mergeBrands(localBrands: Brand[], serverBrands: Brand[]) {
  const merged = new Map<string, Brand>();

  for (const brand of localBrands) {
    merged.set(brand.id, brand);
  }

  for (const serverBrand of serverBrands) {
    const localBrand = merged.get(serverBrand.id);

    merged.set(serverBrand.id, localBrand ? { ...serverBrand, logoIds: Array.from(new Set([serverBrand.selectedLogoId, ...(Array.isArray(serverBrand.logoIds) ? serverBrand.logoIds : []), ...(Array.isArray(localBrand.logoIds) ? localBrand.logoIds : [])])) } : serverBrand);
  }

  return Array.from(merged.values());
}

export function mergeBrandWorkspaces(localWorkspace: BrandWorkspace, serverWorkspace: BrandWorkspace): BrandWorkspace {
  return {
    brands: mergeBrands(localWorkspace.brands, serverWorkspace.brands),
    savedGeneratedLogoOptions: mergeGeneratedLogos(localWorkspace.savedGeneratedLogoOptions, serverWorkspace.savedGeneratedLogoOptions),
    businessCardDrafts: mergeBusinessCardDrafts(localWorkspace.businessCardDrafts, serverWorkspace.businessCardDrafts),
    printProductDrafts: mergeById(localWorkspace.printProductDrafts, serverWorkspace.printProductDrafts),
    orders: mergeById(localWorkspace.orders, serverWorkspace.orders),
    brandAssets: mergeById(localWorkspace.brandAssets, serverWorkspace.brandAssets),
  };
}

export function hasBrandWorkspaceData(workspace: BrandWorkspace) {
  return workspace.brands.length > 0 || workspace.savedGeneratedLogoOptions.length > 0 || workspace.businessCardDrafts.length > 0 || workspace.printProductDrafts.length > 0 || workspace.orders.length > 0 || workspace.brandAssets.length > 0;
}

export function createBrandWorkspaceSignature(workspace: BrandWorkspace) {
  return JSON.stringify(workspace);
}
