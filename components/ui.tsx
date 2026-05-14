"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { bottomTabs } from "@/lib/mock-data";
import type { MainTab } from "@/lib/types";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  full?: boolean;
};

export function PhoneShell({ children, topLeftAction }: { children: ReactNode; topLeftAction?: ReactNode }) {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <section className="relative flex min-h-screen w-full flex-col overflow-hidden bg-surface">
        {topLeftAction ? <div className="flex shrink-0 justify-start px-5 pb-2 pt-1">{topLeftAction}</div> : null}
        {children}
      </section>
    </main>
  );
}

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="phone-scroll flex-1 overflow-y-auto px-5 pb-6 pt-2">{children}</div>
      {footer ? <div className="safe-bottom shrink-0 border-t border-line bg-white/92 px-5 pt-4 backdrop-blur-xl">{footer}</div> : null}
    </div>
  );
}

export function AppButton({ variant = "primary", full = true, className = "", children, ...props }: ButtonProps) {
  const variants = {
    primary: "bg-primary text-white shadow-soft active:bg-primary-strong",
    secondary: "bg-surface-blue text-primary-strong shadow-soft",
    ghost: "bg-transparent text-muted",
  };

  return (
    <button
      className={`${full ? "w-full" : ""} whitespace-nowrap rounded-md px-[clamp(0.75rem,4vw,1.25rem)] py-4 text-[clamp(0.78rem,3.7vw,1rem)] font-extrabold transition duration-200 hover:-translate-y-0.5 ${variants[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function IconBackButton({ className = "", type = "button", "aria-label": ariaLabel = "뒤로가기", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-line bg-surface/95 text-ink shadow-card backdrop-blur-xl transition duration-200 hover:-translate-x-0.5 hover:text-primary active:scale-95 ${className}`}
      type={type}
      aria-label={ariaLabel}
      {...props}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 6 9 12l6 6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ProgressHeader({ eyebrow, title, description, step, total, action, titleClassName = "" }: { eyebrow: string; title: string; description: string; step?: number; total?: number; action?: ReactNode; titleClassName?: string }) {
  return (
    <header className="mb-6 animate-float-in">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-extrabold text-primary-strong">{eyebrow}</span>
        {step && total ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-soft">{step}/{total}</span>
            {action}
          </div>
        ) : action ? (
          <div className="flex items-center gap-2">{action}</div>
        ) : null}
      </div>
      <h1 className={`text-3xl font-black leading-tight tracking-[-0.04em] text-ink ${titleClassName}`}>{title}</h1>
      <p className="mt-3 text-sm font-medium leading-6 text-muted">{description}</p>
      {step && total ? (
        <div className="mt-5 h-1.5 overflow-hidden rounded-sm bg-surface-blue">
          <div className="h-full rounded-sm bg-primary transition-all duration-300" style={{ width: `${(step / total) * 100}%` }} />
        </div>
      ) : null}
    </header>
  );
}

export function SoftCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface p-4 shadow-card ${className}`}>{children}</section>;
}

export function OptionChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={`rounded-md border px-4 py-3 text-sm font-extrabold transition duration-200 ${
        selected ? "border-primary bg-primary text-white shadow-soft" : "border-line bg-surface text-muted hover:border-primary-soft hover:text-primary-strong"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function TextField({ label, value, placeholder, type = "text", onChange }: { label: string; value: string; placeholder: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">{label}</span>
      <input
        className="w-full rounded-md border border-line bg-surface px-4 py-4 text-base font-bold text-ink outline-none transition focus:border-primary focus:shadow-soft"
        autoComplete="off"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function BottomTabs({ activeTab, onChange }: { activeTab: MainTab; onChange: (tab: MainTab) => void }) {
  return (
    <nav className="safe-bottom grid border-t border-line bg-white/95 px-3 pt-2 backdrop-blur-xl" style={{ gridTemplateColumns: `repeat(${bottomTabs.length}, minmax(0, 1fr))` }}>
      {bottomTabs.map((tab) => (
        <button
          key={tab.id}
          className={`grid justify-items-center gap-1 rounded-md px-1 py-2 text-[11px] font-black transition ${activeTab === tab.id ? "text-primary-strong" : "text-soft"}`}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-label={tab.label}
        >
          <span className={`grid h-11 w-11 place-items-center rounded-2xl transition ${activeTab === tab.id ? "bg-surface-blue shadow-soft" : "bg-transparent"}`}>
            <BottomTabIcon tab={tab.id} />
          </span>
          <span className="leading-4">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function BottomTabIcon({ tab }: { tab: MainTab }) {
  const iconClassName = "h-5 w-5";

  if (tab === "home") {
    return (
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-8.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tab === "brands") {
    return (
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="m8.5 9.5 3.5 1.75 3.5-1.75M12 11.25V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tab === "orders") {
    return (
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10a1 1 0 0 1 1 1v16l-3-1.7-3 1.7-3-1.7L6 21V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={iconClassName} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
