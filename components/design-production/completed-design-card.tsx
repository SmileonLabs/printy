"use client";

import type { ReactNode } from "react";

export const completedDesignPreviewClassName = "mx-auto max-w-[220px]";
export const completedDesignPreviewImageSizes = "(max-width: 768px) 50vw, 220px";
export const completedBusinessCardMockupImageSize = { width: 920, height: 1040 } as const;

type CompletedDesignCardProps = {
  preview: ReactNode;
  title?: string;
  subtitle?: string;
  actions: ReactNode;
  notices?: ReactNode;
  layout?: "stack" | "row" | "overlay";
};

export function CompletedDesignCard({ preview, title, subtitle, actions, notices, layout = "stack" }: CompletedDesignCardProps) {
  if (layout === "overlay") {
    return (
      <div className="relative w-full break-inside-avoid overflow-hidden rounded-lg bg-transparent align-top">
        {preview}
        <div className="absolute bottom-2 right-2 top-2 grid w-[min(48%,12rem)] content-center gap-2">
          {actions}
        </div>
        {title ? <p className="mt-2 line-clamp-1 text-[11px] font-black text-ink">{title}</p> : null}
        {subtitle ? <p className="mt-1 text-[11px] font-bold text-muted">{subtitle}</p> : null}
        {notices}
      </div>
    );
  }

  if (layout === "row") {
    return (
      <div className="grid w-full break-inside-avoid grid-cols-[minmax(0,1fr)_minmax(132px,190px)] items-stretch gap-3 rounded-lg bg-transparent align-top">
        <div className="min-w-0 overflow-hidden rounded-lg">{preview}</div>
        <div className="grid content-start gap-2">
          {title ? <p className="line-clamp-1 text-[11px] font-black text-ink">{title}</p> : null}
          {subtitle ? <p className="text-[11px] font-bold text-muted">{subtitle}</p> : null}
          <div className="grid gap-2">{actions}</div>
          {notices}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg bg-transparent align-top transition hover:-translate-y-0.5">
      {preview}
      {title ? <p className="mt-2 line-clamp-1 text-[11px] font-black text-ink">{title}</p> : null}
      {subtitle ? <p className="mt-1 text-[11px] font-bold text-muted">{subtitle}</p> : null}
      <div className="mt-2 grid gap-1.5">
        {actions}
      </div>
      {notices}
    </div>
  );
}
