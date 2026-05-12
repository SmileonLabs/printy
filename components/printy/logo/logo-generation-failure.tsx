"use client";

import { AppButton, SoftCard } from "@/components/ui";

export function LogoGenerationFailure({ message, onRetry, onEdit }: { message?: string; onRetry: () => void; onEdit: () => void }) {
  return (
    <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-surface text-xl font-black text-danger shadow-soft">!</div>
      <p className="text-base font-black text-ink">실제 이미지 생성에 실패했어요</p>
      <p className="mt-2 text-sm font-bold leading-6 text-muted">{message ?? "시안을 생성하지 못했어요. 실패한 상태에서는 기본 로고를 대신 보여주지 않습니다."}</p>
      <div className="mt-5 grid gap-3">
        <AppButton onClick={onRetry}>같은 조건으로 다시 생성</AppButton>
        <AppButton variant="secondary" onClick={onEdit}>입력 수정하기</AppButton>
      </div>
    </SoftCard>
  );
}
