"use client";

import { BusinessCardTemplateRenderer } from "@/components/printy/templates/business-card-template-renderer";
import { LogoMark } from "@/components/ui/logo";
import { getBusinessCardTemplateOrientation } from "@/lib/business-card-templates";
import type { Member, OrderOptions, PrintTemplate, ResolvedLogoOption } from "@/lib/types";

export function BusinessCardPreview({ brandName, category, member, logo, options, template, side = "front" }: { brandName: string; category: string; member: Member; logo: ResolvedLogoOption; options?: OrderOptions; template?: PrintTemplate; side?: "front" | "back" }) {
  if (template?.layout) {
    return <BusinessCardTemplateRenderer brandName={brandName} category={category} member={member} logo={logo} layout={template.layout} side={side} />;
  }

  if (!template) {
    return (
      <div className="rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 shadow-card">
        <div className="aspect-[1.72/1] rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <LogoMark logo={logo} size="sm" />
              <span className="rounded-sm bg-surface-blue px-3 py-1 text-[10px] font-black text-primary-strong">PRINT READY</span>
            </div>
            <div>
              <p className="text-xl font-black tracking-[-0.04em] text-ink">{brandName}</p>
              <p className="mt-1 text-xs font-bold text-muted">{category} · {member.role}</p>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-line pt-3 text-[11px] font-bold text-muted">
              <span>{member.name}</span>
              <span>{member.phone}</span>
              <span>{category}</span>
              <span>{options?.paper ?? "일반"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const orientation = getBusinessCardTemplateOrientation(template);
  const isVertical = orientation === "vertical";
  const badgeText = isVertical ? "VERTICAL" : "HORIZONTAL";

  return (
    <div className="rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 shadow-card">
      <div className={`${isVertical ? "mx-auto aspect-[1/1.58] w-48" : "aspect-[1.72/1] w-full"} rounded-md border border-line bg-surface p-5 shadow-soft`}>
        <div className="flex h-full flex-col justify-between">
          <div className={`flex ${isVertical ? "flex-col items-center gap-3 text-center" : "items-start justify-between"}`}>
            <LogoMark logo={logo} size="sm" />
            <span className="rounded-sm bg-surface-blue px-3 py-1 text-[10px] font-black text-primary-strong">{badgeText}</span>
          </div>
          <div className={isVertical ? "text-center" : ""}>
            <p className="text-xl font-black tracking-[-0.04em] text-ink">{brandName}</p>
            <p className="mt-1 text-xs font-bold text-muted">{category} · {member.role}</p>
          </div>
          <div className={`${isVertical ? "grid gap-2 text-center" : "grid grid-cols-[1fr_auto] gap-3"} border-t border-line pt-3 text-[11px] font-bold text-muted`}>
            <span>{member.name}</span>
            <span>{member.phone}</span>
            <span>{category}</span>
            <span>{options?.paper ?? "일반"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
