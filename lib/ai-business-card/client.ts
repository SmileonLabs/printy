import type { BusinessCardProductionOptions, Member, ResolvedLogoOption } from "@/lib/types";

export type AiBusinessCardClientInput = {
  brandName: string;
  category: string;
  mood?: string;
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
    templateId: input.templateId,
    productionOptions: input.productionOptions,
  };
}

export function createAiBusinessCardMockupSignature(input: AiBusinessCardClientInput) {
  return JSON.stringify({
    brandName: input.brandName.trim(),
    category: input.category.trim(),
    mood: input.mood?.trim() ?? "",
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
      adLine1: input.member.adLine1?.trim() ?? "",
      adLine2: input.member.adLine2?.trim() ?? "",
      instagram: input.member.instagram?.trim() ?? "",
      qrCodeImageUrl: input.member.qrCodeImageUrl?.trim() ?? "",
    },
    productionOptions: input.productionOptions,
  });
}
