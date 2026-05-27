"use client";

import { DesignPreviewOverlay } from "@/components/design-projects/design-preview-overlay";
import { printProductLayoutToDesignLayout } from "@/lib/design-projects";
import type { PrintProductProductionLayout } from "@/lib/types";

type PrintProductPreviewOverlayProps = {
  layout: PrintProductProductionLayout;
  backgroundImageUrl?: string;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  className?: string;
};

export function PrintProductPreviewOverlay({ layout, backgroundImageUrl, logoImageUrl, logoVectorSvgUrl, className = "" }: PrintProductPreviewOverlayProps) {
  return <DesignPreviewOverlay className={`rounded-lg shadow-card ${className}`} layout={printProductLayoutToDesignLayout(layout)} cleanImageUrl={backgroundImageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />;
}
