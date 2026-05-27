import type { Member, OrderOptions, PaymentMethod, ShippingInfo } from "@/lib/types";

export type BrandDraft = {
  name: string;
  category: string;
  designRequest: string;
};

export const defaultMember: Member = {
  id: "member-1",
  name: "",
  role: "",
  phone: "",
  mainPhone: "",
  fax: "",
  email: "",
  website: "",
  address: "",
  account: "",
  instagram: "",
  qrCodeImageUrl: "",
};

export const defaultBrandDraft: BrandDraft = {
  name: "",
  category: "",
  designRequest: "",
};

export const defaultOrderOptions: OrderOptions = {
  quantity: "200",
  paper: "일반",
  finish: "기본",
  delivery: "일반 배송",
};

export const defaultPaymentMethod: PaymentMethod = "간편결제";

export const defaultShippingInfo: ShippingInfo = {
  recipientName: "",
  recipientPhone: "",
  address: "",
  memo: "",
};
