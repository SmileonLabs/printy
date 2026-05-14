import { isGeneratedLogoOption } from "@/lib/logo/logoValidation";
import { normalizeMemberContact } from "@/lib/member-contact";
import { logoOptions } from "@/lib/mock-data";
import type { Brand, BrandAsset, BusinessCardDraft, GeneratedLogoOption, Member } from "@/lib/types";
import { defaultBrandDraft, defaultMember, type BrandDraft } from "@/store/printy-store-defaults";
import { getCreatedDate, makeId } from "@/store/printy-store-id-date";

export function normalizeOptionalString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function normalizeOptionalNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isSelectableLogoId(logoId: unknown, savedGeneratedLogoOptions: GeneratedLogoOption[]): logoId is string {
  return typeof logoId === "string" && (logoOptions.some((option) => option.id === logoId) || savedGeneratedLogoOptions.some((option) => option.id === logoId));
}

export function normalizeSelectableLogoId(logoId: unknown, savedGeneratedLogoOptions: GeneratedLogoOption[], fallback?: string): string {
  if (isSelectableLogoId(logoId, savedGeneratedLogoOptions)) {
    return logoId;
  }

  if (isSelectableLogoId(fallback, savedGeneratedLogoOptions)) {
    return fallback;
  }

  return logoOptions[0].id;
}

export function getLegacyLogoTypeLabel(value: string) {
  const labels: Record<string, string> = {
    text: "텍스트형 로고",
    symbol: "심볼형 로고",
    combination: "텍스트+심볼",
    initial: "이니셜 로고",
    emblem: "엠블럼 로고",
    mascot: "캐릭터 로고",
    abstract: "추상형 로고",
  };

  return labels[value] ?? value;
}

export function makeDesignRequestFromLegacy(record: Record<string, unknown>, fallback: string) {
  const targetAudience = normalizeString(record.targetAudience);
  const tone = normalizeString(record.tone);
  const mood = normalizeString(record.mood);
  const logoTypeId = normalizeString(record.logoTypeId);
  const logoType = normalizeString(record.logoType) || getLegacyLogoTypeLabel(logoTypeId);
  const textStyle = normalizeString(record.textStyle);
  const typographyDirection = normalizeString(record.typographyDirection);
  const designPreference = normalizeString(record.designPreference);
  const parts = [
    targetAudience ? `타깃은 ${targetAudience}` : "",
    tone || mood ? `분위기는 ${tone || mood}` : "",
    logoType ? `로고 형태는 ${logoType}` : "",
    textStyle ? `글자 인상은 ${textStyle}` : "",
    typographyDirection ? `타이포그래피는 ${typographyDirection}` : "",
    designPreference ? `전체 느낌은 ${designPreference}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join(", ")}이면 좋겠어요.` : fallback;
}

export function normalizeDesignRequest(record: Record<string, unknown>, fallback: string) {
  return typeof record.designRequest === "string" ? record.designRequest.trim() : makeDesignRequestFromLegacy(record, fallback);
}

export function normalizeBrandDraft(brandDraft: Partial<BrandDraft> | Record<string, unknown> | undefined, fallback: BrandDraft = defaultBrandDraft): BrandDraft {
  const record = brandDraft ?? {};

  return {
    name: normalizeOptionalString(record.name, fallback.name),
    category: normalizeOptionalString(record.category, fallback.category),
    designRequest: normalizeDesignRequest(record, fallback.designRequest),
  };
}

export function normalizeMember(member: Partial<Member> | Record<string, unknown> | undefined, fallback: Member = defaultMember): Member {
  const record = member ?? {};

  return normalizeMemberContact({
    id: normalizeOptionalString(record.id, fallback.id),
    name: normalizeOptionalString(record.name, fallback.name),
    role: normalizeOptionalString(record.role, fallback.role),
    phone: normalizeOptionalString(record.phone, fallback.phone),
    mainPhone: normalizeOptionalString(record.mainPhone, fallback.mainPhone),
    fax: normalizeOptionalString(record.fax, fallback.fax),
    email: normalizeOptionalString(record.email, fallback.email),
    website: normalizeOptionalString(record.website, fallback.website ?? ""),
    address: normalizeOptionalString(record.address, fallback.address),
  });
}

export function normalizeBrandWithSelectableLogos(brand: Brand | Record<string, unknown>, savedGeneratedLogoOptions: GeneratedLogoOption[]): Brand {
  const record = brand as Record<string, unknown>;
  const selectedLogoId = normalizeSelectableLogoId(record.selectedLogoId, savedGeneratedLogoOptions);
  const logoIds = Array.isArray(record.logoIds) ? record.logoIds.filter((logoId): logoId is string => isSelectableLogoId(logoId, savedGeneratedLogoOptions)) : [];
  const normalizedLogoIds = Array.from(new Set([selectedLogoId, ...logoIds]));

  return {
    id: normalizeOptionalString(record.id, makeId("brand", 0)),
    name: normalizeOptionalString(record.name, defaultBrandDraft.name),
    category: normalizeOptionalString(record.category, defaultBrandDraft.category),
    designRequest: normalizeDesignRequest(record, defaultBrandDraft.designRequest),
    selectedLogoId,
    logoIds: normalizedLogoIds,
    members: Array.isArray(record.members) ? record.members.map((member, index) => normalizeMember(typeof member === "object" && member !== null ? (member as Record<string, unknown>) : undefined, { ...defaultMember, id: makeId("member", index) })) : [],
    createdAt: normalizeOptionalString(record.createdAt, "방금 생성"),
    assets: normalizeOptionalNumber(record.assets, 4),
  };
}

export function normalizeBrand(brand: Brand | Record<string, unknown>): Brand {
  return normalizeBrandWithSelectableLogos(brand, []);
}

export function normalizeBusinessCardDraftWithSelectableLogos(draft: BusinessCardDraft | Record<string, unknown>, savedGeneratedLogoOptions: GeneratedLogoOption[]): BusinessCardDraft {
  const record = draft as Record<string, unknown>;

  return {
    id: normalizeOptionalString(record.id, makeId("card", 0)),
    brandId: typeof record.brandId === "string" ? record.brandId : undefined,
    brandName: normalizeOptionalString(record.brandName, defaultBrandDraft.name),
    category: normalizeOptionalString(record.category, defaultBrandDraft.category),
    designRequest: normalizeDesignRequest(record, defaultBrandDraft.designRequest),
    selectedLogoId: normalizeSelectableLogoId(record.selectedLogoId, savedGeneratedLogoOptions),
    templateId: typeof record.templateId === "string" ? record.templateId : undefined,
    member: normalizeMember(typeof record.member === "object" && record.member !== null ? (record.member as Record<string, unknown>) : undefined),
    createdAt: normalizeOptionalString(record.createdAt, getCreatedDate()),
  };
}

export function normalizeBusinessCardDraft(draft: BusinessCardDraft | Record<string, unknown>): BusinessCardDraft {
  return normalizeBusinessCardDraftWithSelectableLogos(draft, []);
}

export function normalizeBrandAsset(asset: BrandAsset | Record<string, unknown>): BrandAsset | undefined {
  const record = asset as Record<string, unknown>;
  const id = normalizeString(record.id);
  const brandId = normalizeString(record.brandId);
  const sectionId = normalizeString(record.sectionId);
  const productId = normalizeString(record.productId);
  const title = normalizeString(record.title);

  if (!id || !brandId || !sectionId || !productId || !title) {
    return undefined;
  }

  const assetType = record.assetType === "mockup" || record.assetType === "brand-board" || record.assetType === "file" ? record.assetType : undefined;

  return {
    id,
    brandId,
    sectionId: sectionId as BrandAsset["sectionId"],
    productId,
    title,
    description: normalizeString(record.description),
    imageUrl: typeof record.imageUrl === "string" && record.imageUrl.trim().length > 0 ? record.imageUrl.trim() : undefined,
    assetType,
    createdAt: normalizeOptionalString(record.createdAt, getCreatedDate()),
  };
}

export function normalizeGeneratedLogos(logos: unknown): GeneratedLogoOption[] {
  return Array.isArray(logos) ? logos.filter(isGeneratedLogoOption) : [];
}
