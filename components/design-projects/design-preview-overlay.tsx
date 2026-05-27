"use client";

import { businessCardTemplateIconArtwork } from "@/lib/business-card-templates";
import { designBackgroundStyle, designBoxStyle, designCleanMockupPageStyle, designElementValue, designLayoutAspectRatio, designPageFrameStyle, designTextStyle, visibleDesignElements, type DesignElementValues } from "@/lib/design-projects";
import type { DesignElement, DesignLayout, DesignLogoElement } from "@/lib/design-projects";

type DesignPreviewOverlayProps = {
  layout: DesignLayout;
  cleanImageUrl?: string;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  values?: DesignElementValues;
  className?: string;
};

function logoUrl(element: DesignLogoElement, logoImageUrl: string | undefined, logoVectorSvgUrl: string | undefined) {
  return element.assetType === "svg" && logoVectorSvgUrl ? logoVectorSvgUrl : logoImageUrl;
}

function DesignIcon({ element }: { element: Extract<DesignElement, { type: "icon" }> }) {
  const artwork = businessCardTemplateIconArtwork[element.icon];

  return (
    <div className="absolute" style={{ ...designBoxStyle(element.box), color: element.color }}>
      <svg className="block h-full w-full" viewBox={artwork.viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d={artwork.path} fill="currentColor" />
      </svg>
    </div>
  );
}

function DesignElementPreview({ element, values, logoImageUrl, logoVectorSvgUrl }: { element: DesignElement; values?: DesignElementValues; logoImageUrl?: string; logoVectorSvgUrl?: string }) {
  if (element.type === "logo") {
    const src = logoUrl(element, logoImageUrl, logoVectorSvgUrl);

    return src ? <img className="absolute object-contain" src={src} alt="브랜드 로고" style={designBoxStyle(element.box)} /> : null;
  }

  if (element.type === "qr") {
    const value = designElementValue(element, values)?.trim();

    return value ? <img className="absolute object-contain" src={value} alt="QR 코드" style={designBoxStyle(element.box)} /> : null;
  }

  if (element.type === "icon") {
    return <DesignIcon element={element} />;
  }

  if (element.type === "line") {
    return <div className="absolute" style={{ ...designBoxStyle(element.box), backgroundColor: element.color }} />;
  }

  if (element.type === "shape") {
    return (
      <div className="absolute flex items-center justify-center rounded-full border-2 text-center font-black leading-none" style={{ ...designBoxStyle(element.box), backgroundColor: element.fillColor, borderColor: element.strokeColor, color: element.textColor, fontSize: `${Math.max(10, element.box.height * 1.5)}px` }} title={element.prompt}>
        {element.glyph}
      </div>
    );
  }

  const value = designElementValue(element, values)?.trim();

  if (!value) {
    return null;
  }

  return (
    <div className="absolute overflow-hidden" style={{ ...designBoxStyle(element.box), containerType: "size" }}>
      <span className="block overflow-hidden whitespace-pre" style={designTextStyle(element, 1, value)}>{value}</span>
    </div>
  );
}

export function DesignPreviewOverlay({ layout, cleanImageUrl, logoImageUrl, logoVectorSvgUrl, values, className = "" }: DesignPreviewOverlayProps) {
  return (
    <div className={`relative w-full overflow-hidden rounded-md border border-line bg-white shadow-soft ${className}`} style={{ aspectRatio: designLayoutAspectRatio(layout) }}>
      {layout.pages.map((page, pageIndex) => (
        <div key={page.id} className="absolute left-0 w-full overflow-hidden" style={{ ...designPageFrameStyle(layout, pageIndex), ...designBackgroundStyle(page.background), ...designCleanMockupPageStyle(cleanImageUrl, layout, pageIndex) }}>
          {visibleDesignElements(page).map((element) => <DesignElementPreview key={element.id} element={element} values={values} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />)}
        </div>
      ))}
    </div>
  );
}
