import type { BusinessCardProductionOptions, Member, ResolvedLogoOption } from "@/lib/types";

export type AiBusinessCardClientInput = {
  brandName: string;
  category: string;
  mood?: string;
  mockupRequest?: string;
  referenceImageDataUrl?: string;
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
    referenceImageDataUrl: input.referenceImageDataUrl,
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
  const layoutJson = JSON.stringify(input.productionOptions?.layout ?? null);

  return JSON.stringify({
    version: 2,
    brandName: input.brandName.trim(),
    category: input.category.trim(),
    mood: input.mood?.trim() ?? "",
    mockupRequest: input.mockupRequest?.trim() ?? "",
    referenceImageFingerprint: createShortStringFingerprint(input.referenceImageDataUrl?.trim() ?? ""),
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
      instagram: input.member.instagram?.trim() ?? "",
      qrCodeImageFingerprint: createShortStringFingerprint(input.member.qrCodeImageUrl?.trim() ?? ""),
    },
    productionOptions: {
      frontElements: input.productionOptions?.frontElements ?? [],
      backElements: input.productionOptions?.backElements ?? [],
      color: input.productionOptions?.color ?? "blue",
      layoutFingerprint: createShortStringFingerprint(layoutJson),
    },
  });
}
