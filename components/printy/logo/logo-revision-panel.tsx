"use client";

import Image from "next/image";
import { AppButton, SoftCard } from "@/components/ui";
import { logoUiCopy } from "@/lib/logo/logoUiCopy";
import type { GeneratedLogoOption } from "@/lib/types";

export function LogoRevisionPanel({ logo, value, onChange, onSubmit, onCancel }: { logo: GeneratedLogoOption; value: string; onChange: (value: string) => void; onSubmit: () => void; onCancel: () => void }) {
  const canSubmit = value.trim().length > 0;

  return (
    <SoftCard className="mt-5 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-primary-strong">선택 로고 기반 수정</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">수정 요청을 적어주세요</h2>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">{logoUiCopy.revisionGeneration.panelDescription}</p>
        </div>
        <span className="shrink-0 rounded-md bg-surface px-3 py-1 text-[10px] font-black text-primary-strong">수정 로고</span>
      </div>
      <div className="grid gap-4">
        <div className="grid aspect-square place-items-center overflow-hidden rounded-md border border-line bg-surface p-4 shadow-soft">
          <Image src={logo.imageUrl} alt={`${logo.name} 수정 원본`} width={320} height={320} className="h-full w-full object-contain" unoptimized />
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-extrabold text-soft">수정 요청</span>
          <textarea
            className="min-h-32 w-full resize-none rounded-md border border-line bg-surface px-4 py-4 text-base font-bold leading-7 text-ink outline-none transition focus:border-primary focus:shadow-soft"
            placeholder="예: 원형 구성은 유지하고, 심볼을 조금 더 단순하게 정리하면서 색을 따뜻한 베이지 톤으로 바꿔 주세요."
            maxLength={1000}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <div className="grid gap-3">
          <AppButton onClick={onSubmit} disabled={!canSubmit} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            수정 로고 만들기
          </AppButton>
          <AppButton variant="ghost" onClick={onCancel}>
            취소
          </AppButton>
        </div>
      </div>
    </SoftCard>
  );
}
