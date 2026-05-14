"use client";

export function DesignRequestField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-extrabold text-soft">디자인 요청</span>
      <textarea
        className="min-h-40 w-full resize-none rounded-md border border-line bg-surface px-4 py-4 text-base font-bold leading-7 text-ink outline-none transition focus:border-primary focus:shadow-soft"
        autoComplete="off"
        placeholder="친구에게 말하듯 자유롭게 적어주세요. 동네 베이커리인데 따뜻하지만 너무 귀엽지는 않게, 빵 모양은 은근하게만 넣고, 명함에서 브랜드명이 크게 잘 보였으면 좋겠어요."
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="mt-2 block text-xs font-bold leading-5 text-muted">색상, 피하고 싶은 요소, 아이콘, 글자 느낌까지 한 문장으로 적어도 됩니다. 비워두면 자동 모드처럼 Printy가 요청을 작성합니다.</span>
    </label>
  );
}
