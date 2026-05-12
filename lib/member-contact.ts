import type { Member } from "@/lib/types";

const legacyMemberContactDefaults = {
  mainPhone: "02-6959-1190",
  fax: "02-6959-1191",
  email: "hello@printy.kr",
  website: "www.printy.kr",
  address: "서울시 성동구 프린티로 12, 3층",
} as const;

function normalizeOptionalContactValue(value: string | undefined, phone: string, legacyDefaultValue: string) {
  const normalized = value?.trim() ?? "";

  return normalized === phone || normalized === legacyDefaultValue ? "" : normalized;
}

export function normalizeMemberContact(member: Member | (Partial<Member> & Pick<Member, "id" | "name" | "role" | "phone">)): Member {
  const phone = member.phone.trim();

  return {
    ...member,
    phone,
    mainPhone: normalizeOptionalContactValue(member.mainPhone, phone, legacyMemberContactDefaults.mainPhone),
    fax: normalizeOptionalContactValue(member.fax, phone, legacyMemberContactDefaults.fax),
    email: normalizeOptionalContactValue(member.email, phone, legacyMemberContactDefaults.email),
    website: normalizeOptionalContactValue(member.website, phone, legacyMemberContactDefaults.website),
    address: normalizeOptionalContactValue(member.address, phone, legacyMemberContactDefaults.address),
  };
}
