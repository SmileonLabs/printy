"use client";

import { DesignPreviewOverlay } from "@/components/design-projects/design-preview-overlay";
import { displayBusinessCardFieldValue } from "@/lib/business-card-rendering";
import { businessCardLayoutToDesignLayout, type DesignElementValues } from "@/lib/design-projects";
import type { BusinessCardTemplateLayout, BusinessCardTemplateTextFieldId, Member, ResolvedLogoOption } from "@/lib/types";

type BusinessCardPrintPreviewOverlayProps = {
  cleanImageUrl: string;
  layout: BusinessCardTemplateLayout;
  member: Member;
  logo?: ResolvedLogoOption;
  className?: string;
};

const fieldIds: BusinessCardTemplateTextFieldId[] = ["role", "name", "phone", "email", "website", "address", "mainPhone", "fax", "account", "instagram", "qrCode"];

function memberFieldValue(member: Member, fieldId: BusinessCardTemplateTextFieldId) {
  if (fieldId === "qrCode") {
    return member.qrCodeImageUrl?.trim() ?? "";
  }

  if (fieldId.startsWith("headline-") || fieldId.startsWith("body-")) return "";
  return member[fieldId as keyof Pick<Member, "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "instagram">]?.trim() ?? "";
}

function memberValues(member: Member): DesignElementValues {
  return fieldIds.reduce<DesignElementValues>((values, fieldId) => {
    const value = memberFieldValue(member, fieldId);

    values[fieldId] = fieldId === "qrCode" ? value : displayBusinessCardFieldValue(fieldId, value);
    return values;
  }, {});
}

function logoImageUrl(logo: ResolvedLogoOption | undefined) {
  return logo && "imageUrl" in logo ? logo.imageUrl : undefined;
}

function logoVectorSvgUrl(logo: ResolvedLogoOption | undefined) {
  return logo && "imageUrl" in logo ? logo.vectorSvgUrl : undefined;
}

export function BusinessCardPrintPreviewOverlay({ cleanImageUrl, layout, member, logo, className }: BusinessCardPrintPreviewOverlayProps) {
  return <DesignPreviewOverlay className={className} layout={businessCardLayoutToDesignLayout(layout)} cleanImageUrl={cleanImageUrl} logoImageUrl={logoImageUrl(logo)} logoVectorSvgUrl={logoVectorSvgUrl(logo)} values={memberValues(member)} />;
}
