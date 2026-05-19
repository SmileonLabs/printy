"use client";

import Image from "next/image";

export function QrCodeImageField({ value, onChange, onClear }: { value: string; onChange: (file: File | undefined) => void; onClear: () => void }) {
  return (
    <div className="rounded-md border border-line bg-surface-blue p-3">
      <label className="block text-xs font-extrabold text-primary-strong">
        QR 코드 이미지
        <input className="mt-2 block w-full rounded-md border border-line bg-white px-3 py-2 text-xs font-bold text-ink file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-black file:text-white" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*" onChange={(event) => onChange(event.currentTarget.files?.[0])} />
      </label>
      <p className="mt-2 text-xs font-bold leading-5 text-muted">관리자 템플릿에서 QR 코드 요소를 켠 위치에 이 이미지가 들어가요.</p>
      {value ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-sm border border-line bg-white">
            <Image src={value} alt="업로드한 QR 코드" fill sizes="64px" className="object-contain" unoptimized />
          </div>
          <button className="rounded-sm bg-white px-3 py-2 text-xs font-black text-danger shadow-soft" type="button" onClick={onClear}>
            QR 삭제
          </button>
        </div>
      ) : null}
    </div>
  );
}
