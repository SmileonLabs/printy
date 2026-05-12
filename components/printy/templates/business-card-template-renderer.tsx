"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BusinessCardInfoBlockRenderer } from "@/components/business-card-info-block-renderer";
import { businessCardTemplateIconArtwork } from "@/lib/business-card-templates";
import { backgroundColor, boxStyle, businessCardIconChromeStyle, businessCardLogoShapeBorderColor, businessCardTrimWidthScale, cssPxPerMm, displayBusinessCardFieldValue, fittedBusinessCardFontSizePx, fontFamilies, formatPercent, getBusinessCardTrimMetrics, readSafeColor, resolveBusinessCardContactLayout } from "@/lib/business-card-rendering";
import type { BusinessCardTemplateBackground, BusinessCardTemplateBox, BusinessCardTemplateIconElement, BusinessCardTemplateLayout, BusinessCardTemplateLineElement, BusinessCardTemplateSideId, BusinessCardTemplateTextElement, BusinessCardTemplateTextFieldId, Member, ResolvedLogoOption } from "@/lib/types";

type BusinessCardTemplateRendererProps = {
  brandName: string;
  category: string;
  member: Member;
  logo: ResolvedLogoOption;
  layout: BusinessCardTemplateLayout;
  side?: BusinessCardTemplateSideId;
  showGuides?: boolean;
  className?: string;
  chrome?: boolean;
};

function cssUrl(value: string) {
  return `url(${JSON.stringify(value)})`;
}

function readBackgroundImageUrl(background: BusinessCardTemplateBackground) {
  return background.enabled && background.type === "image" ? background.imageUrl.trim() : "";
}

function fieldValue(fieldId: BusinessCardTemplateTextFieldId, brandName: string, category: string, member: Member) {
  const values: Record<BusinessCardTemplateTextFieldId, string> = {
    role: member.role || category,
    name: member.name || brandName,
    phone: member.phone,
    mainPhone: member.mainPhone,
    fax: member.fax,
    email: member.email,
    website: member.website ?? "",
    address: member.address,
  };

  return values[fieldId];
}

function logoShapeStyle(logo: Exclude<ResolvedLogoOption, { imageUrl: string }>): CSSProperties {
  const twoMm = `${formatPercent(2 * cssPxPerMm, 8)}px`;
  const baseStyle: CSSProperties = {
    background: logo.background,
    border: `${formatPercent(0.2 * cssPxPerMm, 0.756)}px solid ${businessCardLogoShapeBorderColor}`,
    color: logo.accent,
    fontSize: `${formatPercent(8 * cssPxPerMm, 30.236)}px`,
    fontWeight: 900,
    lineHeight: 1,
  };

  if (logo.shape === "circle" || logo.shape === "pill") {
    return { ...baseStyle, borderRadius: `${formatPercent(999 * cssPxPerMm, 3775)}px` };
  }

  if (logo.shape === "square" || logo.shape === "spark") {
    return { ...baseStyle, borderRadius: twoMm };
  }

  if (logo.shape === "diamond") {
    return { ...baseStyle, borderRadius: `${formatPercent(1.5 * cssPxPerMm, 5.669)}px`, transform: "rotate(45deg) scale(0.72)" };
  }

  return { ...baseStyle, borderRadius: `${formatPercent(999 * cssPxPerMm, 3775)}px ${formatPercent(999 * cssPxPerMm, 3775)}px ${twoMm} ${twoMm}` };
}

function LogoArtwork({ logo }: { logo: ResolvedLogoOption }) {
  if ("imageUrl" in logo) {
    return <Image src={logo.imageUrl} alt={logo.name} fill sizes="160px" className="object-contain" draggable={false} unoptimized />;
  }

  return (
    <div className="relative grid h-full w-full place-items-center" style={logoShapeStyle(logo)} aria-label={logo.name}>
      <span className="block" style={logo.shape === "diamond" ? { transform: "rotate(-45deg)" } : undefined}>{logo.initial}</span>
      {logo.shape === "spark" ? <span className="absolute rounded-full" style={{ right: "12%", top: "12%", height: "12%", width: "12%", background: "currentColor" }} /> : null}
    </div>
  );
}

function GuideBox({ box, tone }: { box: BusinessCardTemplateBox; tone: "edit" | "safe" }) {
  return <div className={`pointer-events-none absolute rounded-sm ${tone === "edit" ? "border border-dashed border-danger/60" : "border border-dashed border-primary/70"}`} style={boxStyle(box)} />;
}

function TextElement({ field, brandName, category, member, cssPixelScale, trimWidthScale }: { field: BusinessCardTemplateTextElement; brandName: string; category: string; member: Member; cssPixelScale: number; trimWidthScale: number }) {
  const rawValue = field.customValue ?? fieldValue(field.id, brandName, category, member);
  const value = displayBusinessCardFieldValue(field.id, rawValue);

  if (!field.visible || value.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute z-[2] flex items-center overflow-hidden"
      style={{
        ...boxStyle(field.box),
        color: readSafeColor(field.color, "#111827"),
        fontFamily: fontFamilies[field.fontFamily],
        fontSize: `${fittedBusinessCardFontSizePx(field, value, cssPixelScale, field.box.width, 16 * cssPixelScale, trimWidthScale)}px`,
        fontStyle: field.italic || field.fontFamily === "handwriting" ? "italic" : "normal",
        fontWeight: field.fontWeight === "bold" ? 900 : 400,
        lineHeight: 1.3,
        padding: `0 ${formatPercent(8 * cssPixelScale, 4)}px`,
        textAlign: field.align,
      }}
    >
      <span className="block w-full overflow-hidden whitespace-nowrap">{value}</span>
    </div>
  );
}

function LineElement({ line }: { line: BusinessCardTemplateLineElement }) {
  if (!line.visible) {
    return null;
  }

  return <div className="absolute z-[2]" style={{ ...boxStyle(line.box), backgroundColor: readSafeColor(line.color, "#111827") }} />;
}

function IconElement({ icon, cssPixelScale }: { icon: BusinessCardTemplateIconElement; cssPixelScale: number }) {
  if (!icon.visible) {
    return null;
  }

  const artwork = businessCardTemplateIconArtwork[icon.icon];
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);

  return (
    <div className="absolute z-[2] overflow-hidden" style={{ ...boxStyle(icon.box), border: `${iconChrome.borderWidthPx}px solid transparent`, color: readSafeColor(icon.color, "#075dcb"), padding: `${iconChrome.paddingPx}px` }}>
      <svg className="block h-full w-full" viewBox={artwork.viewBox} aria-hidden="true">
        <path d={artwork.path} fill="currentColor" />
      </svg>
    </div>
  );
}

function BusinessCardTrimImage({ brandName, category, member, logo, layout, side, showGuides, className = "" }: Omit<BusinessCardTemplateRendererProps, "chrome"> & { side: BusinessCardTemplateSideId }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const sideLayout = layout.sides[side];
  const backgroundImageUrl = readBackgroundImageUrl(sideLayout.background);
  const metrics = useMemo(() => getBusinessCardTrimMetrics(layout.canvas.trim), [layout.canvas.trim]);
  const trimWidthScale = useMemo(() => businessCardTrimWidthScale(layout.canvas.trim), [layout.canvas.trim]);
  const contactLayout = useMemo(() => resolveBusinessCardContactLayout(sideLayout.fields, sideLayout.icons, (field) => field.customValue ?? fieldValue(field.id, brandName, category, member)), [brandName, category, member, sideLayout.fields, sideLayout.icons]);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const updateScale = () => {
      setScale(frame.clientWidth > 0 ? frame.clientWidth / metrics.trimWidthCssPx : 1);
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);

    return () => observer.disconnect();
  }, [metrics.trimWidthCssPx]);

  return (
    <div ref={frameRef} className={`relative mx-auto w-full max-w-md overflow-hidden bg-white ${className}`} style={{ aspectRatio: `${metrics.trimWidthMm} / ${metrics.trimHeightMm}` }}>
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: `${formatPercent(metrics.trimWidthCssPx, 340.157)}px`,
          height: `${formatPercent(metrics.trimHeightCssPx, 188.976)}px`,
          backgroundColor: backgroundColor(sideLayout.background),
          transform: `scale(${scale})`,
          transformOrigin: "left top",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        {backgroundImageUrl.length > 0 ? <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: cssUrl(backgroundImageUrl) }} /> : null}
        {showGuides ? <GuideBox box={layout.canvas.edit} tone="edit" /> : null}
        {showGuides ? <GuideBox box={layout.canvas.safe} tone="safe" /> : null}
        {sideLayout.logo.visible ? (
          <div className="absolute z-[2] overflow-hidden" style={boxStyle(sideLayout.logo.box)}>
            <div className="absolute" style={{ inset: `${formatPercent(cssPxPerMm, 3.78)}px` }}>
              <LogoArtwork logo={logo} />
            </div>
          </div>
        ) : null}
        {contactLayout.blocks.map((block) => (
          <BusinessCardInfoBlockRenderer key={block.id} block={block} cssPixelScale={metrics.cssPixelScale} trimWidthScale={trimWidthScale} />
        ))}
        {contactLayout.fields.map((field) => (
          <TextElement key={field.id} field={field} brandName={brandName} category={category} member={member} cssPixelScale={metrics.cssPixelScale} trimWidthScale={trimWidthScale} />
        ))}
        {contactLayout.icons.map((icon) => (
          <IconElement key={icon.id} icon={icon} cssPixelScale={metrics.cssPixelScale} />
        ))}
        {sideLayout.lines.map((line) => (
          <LineElement key={line.id} line={line} />
        ))}
      </div>
    </div>
  );
}

export function BusinessCardTemplateRenderer({ brandName, category, member, logo, layout, side = "front", showGuides = false, className = "", chrome = true }: BusinessCardTemplateRendererProps) {
  if (!chrome) {
    return <BusinessCardTrimImage brandName={brandName} category={category} member={member} logo={logo} layout={layout} side={side} showGuides={showGuides} className={className} />;
  }

  return (
    <div className={`rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-4 shadow-card ${className}`}>
      <BusinessCardTrimImage brandName={brandName} category={category} member={member} logo={logo} layout={layout} side={side} showGuides={showGuides} />
    </div>
  );
}
