import type { BusinessCardProductionOptions, Member, ResolvedLogoOption } from "@/lib/types";

export type AiBusinessCardClientInput = {
  brandName: string;
  category: string;
  mood?: string;
  mockupRequest?: string;
  member: Member;
  logo?: ResolvedLogoOption;
  templateId?: string;
  productionOptions?: BusinessCardProductionOptions;
};

export function createAiBusinessCardRequestBody(input: AiBusinessCardClientInput) {
  return {
    brandName: input.brandName,
    category: input.category,
    member: input.member,
    logo: input.logo,
    mood: input.mood,
    mockupRequest: input.mockupRequest,
    templateId: input.templateId,
    productionOptions: input.productionOptions,
  };
}

function createShortStringFingerprint(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${value.length}:${(hash >>> 0).toString(36)}`;
}

export function createAiBusinessCardMockupSignature(input: AiBusinessCardClientInput) {
  return JSON.stringify({
    brandName: input.brandName.trim(),
    category: input.category.trim(),
    mood: input.mood?.trim() ?? "",
    mockupRequest: input.mockupRequest?.trim() ?? "",
    logoId: input.logo?.id ?? "",
    templateId: input.templateId ?? "",
    member: {
      name: input.member.name.trim(),
      role: input.member.role.trim(),
      phone: input.member.phone.trim(),
      mainPhone: input.member.mainPhone.trim(),
      fax: input.member.fax.trim(),
      email: input.member.email.trim(),
      website: input.member.website?.trim() ?? "",
      address: input.member.address.trim(),
      account: input.member.account?.trim() ?? "",
      titleLine1: input.member.titleLine1?.trim() ?? "",
      titleLine2: input.member.titleLine2?.trim() ?? "",
      adLine1: input.member.adLine1?.trim() ?? "",
      adLine2: input.member.adLine2?.trim() ?? "",
      instagram: input.member.instagram?.trim() ?? "",
      qrCodeImageFingerprint: createShortStringFingerprint(input.member.qrCodeImageUrl?.trim() ?? ""),
    },
    productionOptions: input.productionOptions,
    layout: input.productionOptions?.layout,
  });
}
