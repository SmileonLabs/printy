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
};

export function CompletedDesignCard({ preview, title, subtitle, actions, notices }: CompletedDesignCardProps) {
  return (
    <div className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-[18px] border border-line bg-surface p-2 align-top shadow-soft transition hover:-translate-y-0.5 hover:shadow-floating">
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
