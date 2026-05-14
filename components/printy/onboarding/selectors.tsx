"use client";

import { OptionChip } from "@/components/ui";
import type { LogoGenerationMode } from "@/lib/types";

const recommendedIndustries = ["카페", "음식점", "네일샵", "미용실", "헬스장", "학원", "병원", "부동산", "AI 컨설팅", "반려동물 수제간식"];

export function GenerationModeSelector({ selected, onSelect }: { selected: LogoGenerationMode; onSelect: (value: LogoGenerationMode) => void }) {
  const options: Array<{ id: LogoGenerationMode; title: string; description: string }> = [
    { id: "manual", title: "내 요청을 해석", description: "친구에게 말하듯 적은 요청을 로고에 반영" },
    { id: "reference", title: "레퍼런스 참고해서 제작", description: "관리자가 등록한 참고 이미지의 분위기와 색감 참고" },
    { id: "auto", title: "알아서 만들어 주세요", description: "브랜드명과 업종만으로 Printy가 요청을 내부 작성" },
  ];

  return (
    <section>

      <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 shadow-card">
        {options.map((option) => {
          const isSelected = selected === option.id;

          return (
            <button key={option.id} className={`rounded-md border p-3 text-left transition duration-200 ${isSelected ? "border-primary bg-surface-blue shadow-soft ring-4 ring-primary-soft" : "border-line bg-surface hover:border-primary-soft hover:bg-surface-blue"}`} type="button" onClick={() => onSelect(option.id)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-ink">{option.title}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-muted">{option.description}</p>
                </div>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${isSelected ? "bg-primary" : "bg-soft"}`} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function IndustrySelector({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-ink">업종 입력</h2>
          <p className="mt-1 text-xs font-bold text-muted">목록에 없어도 괜찮아요. 브랜드에 가장 가까운 표현을 직접 적어주세요.</p>
        </div>
        {selected.trim().length > 0 ? <span className="shrink-0 rounded-md bg-primary px-3 py-1 text-[10px] font-black text-white shadow-soft">{selected}</span> : null}
      </div>
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
        <label className="block">
          <span className="mb-2 block text-xs font-black text-soft">업종</span>
          <input className="w-full rounded-md border border-line bg-white px-4 py-4 text-sm font-black text-ink outline-none transition placeholder:text-soft focus:border-primary focus:shadow-soft" autoComplete="off" maxLength={100} placeholder="자유롭게 업종을 입력" value={selected} onChange={(event) => onSelect(event.target.value)} />
        </label>
        <div className="rounded-lg border border-line bg-surface-blue p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-primary-strong">추천 업종</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-muted">가까운 예시가 있으면 눌러서 빠르게 입력할 수 있어요.</p>
            </div>
            <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-[10px] font-black text-primary-strong">선택 사항</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendedIndustries.map((item) => (
              <OptionChip key={item} label={item} selected={selected === item} onClick={() => onSelect(item)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Selector({ title, options, selected, onSelect }: { title: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-black text-ink">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionChip key={option} label={option} selected={selected === option} onClick={() => onSelect(option)} />
        ))}
      </div>
    </section>
  );
}
