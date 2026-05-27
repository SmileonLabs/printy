"use client";

import type { ReactNode } from "react";

export type ToastNoticeTone = "info" | "success" | "danger";

type ToastNoticeProps = {
  eyebrow: string;
  message: string;
  tone?: ToastNoticeTone;
  loading?: boolean;
  action?: ReactNode;
  onDismiss?: () => void;
};

const toneClasses: Record<ToastNoticeTone, string> = {
  info: "border-primary-soft bg-surface-blue text-primary-strong",
  success: "border-success/20 bg-success/10 text-success",
  danger: "border-danger/20 bg-red-50 text-danger",
};

export function ToastNoticeViewport({ children }: { children: ReactNode }) {
  return <div className="pointer-events-none absolute inset-x-0 top-20 z-40 grid gap-2 px-4 sm:px-5">{children}</div>;
}

export function ToastNotice({ eyebrow, message, tone = "info", loading = false, action, onDismiss }: ToastNoticeProps) {
  const effectiveDismiss = loading ? undefined : onDismiss;

  return (
    <div className={`pointer-events-auto mx-auto w-full max-w-md animate-[float-in_180ms_ease-out] rounded-lg border border-line bg-white/95 p-3 shadow-floating backdrop-blur ${effectiveDismiss ? "cursor-pointer" : ""}`} role={effectiveDismiss ? "button" : undefined} tabIndex={effectiveDismiss ? 0 : undefined} onClick={effectiveDismiss} onKeyDown={(event) => {
      if (!effectiveDismiss || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }

      event.preventDefault();
      effectiveDismiss();
    }} title={effectiveDismiss ? "알림 닫기" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black ${toneClasses[tone]}`}>{eyebrow}</span>
          <p className="mt-2 text-xs font-black leading-5 text-ink">{message}</p>
        </div>
        {loading ? <span className="mt-2 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-primary" aria-label="진행 중" /> : null}
      </div>
      {action ? <div className="mt-2" onClick={(event) => event.stopPropagation()}>{action}</div> : null}
    </div>
  );
}
