"use client";

import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, TextField } from "@/components/ui";
import type { Member } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

export function MemberInputScreen() {
  const { memberDraft, updateMemberDraft, setStep } = usePrintyStore();
  const requiredFields: Array<{ label: string; field: keyof Pick<Member, "name" | "phone">; placeholder: string }> = [
    { label: "이름", field: "name", placeholder: "김하린" },
    { label: "휴대폰", field: "phone", placeholder: "010-0000-0000" },
  ];
  const optionalFields: Array<{ label: string; field: keyof Pick<Member, "role" | "mainPhone" | "fax" | "email" | "address" | "website">; placeholder: string }> = [
    { label: "직함", field: "role", placeholder: "대표" },
    { label: "대표전화", field: "mainPhone", placeholder: "02-0000-0000" },
    { label: "팩스", field: "fax", placeholder: "02-0000-0001" },
    { label: "이메일", field: "email", placeholder: "hello@brand.kr" },
    { label: "주소", field: "address", placeholder: "서울시 성동구 프린티로 12, 3층" },
    { label: "웹도메인", field: "website", placeholder: "www.brand.kr" },
  ];
  const canContinue = memberDraft.name.trim().length > 0 && memberDraft.phone.trim().length > 0;

  return (
    <Screen footer={<AppButton onClick={() => setStep("businessCardPreview")} disabled={!canContinue} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">명함 만들기</AppButton>}>
      <ProgressHeader eyebrow="구성원 입력" title="명함에 들어갈 정보를 확인해요" description="먼저 대표 구성원 1명의 정보를 넣어주세요. 나중에 팀 / 구성원 메뉴에서 더 추가할 수 있어요." step={stepNumbers.memberInput} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <div className="grid gap-4">
        <section className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div>
            <p className="text-sm font-black text-ink">필수항목</p>
            <p className="mt-1 text-xs font-bold text-muted">이름과 휴대폰은 명함 제작에 꼭 필요해요.</p>
          </div>
          {requiredFields.map((field) => (
            <TextField key={field.field} label={field.label} placeholder={field.placeholder} value={memberDraft[field.field]} onChange={(value) => updateMemberDraft(field.field, value)} />
          ))}
        </section>
        <section className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div>
            <p className="text-sm font-black text-ink">선택항목</p>
            <p className="mt-1 text-xs font-bold text-muted">비워두면 해당 정보는 템플릿에서 자동으로 숨겨져요.</p>
          </div>
          {optionalFields.map((field) => (
            <TextField key={field.field} label={field.label} placeholder={field.placeholder} value={memberDraft[field.field] ?? ""} onChange={(value) => updateMemberDraft(field.field, value)} />
          ))}
        </section>
      </div>
    </Screen>
  );
}
