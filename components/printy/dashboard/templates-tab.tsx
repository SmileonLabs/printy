"use client";

import { ProgressHeader, SoftCard } from "@/components/ui";
import type { PrintTemplate } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

export function TemplatesTab() {
  const { templates, printProducts, selectedTemplateId, selectedProductId, selectTemplate } = usePrintyStore();
  const selectedProduct = printProducts.find((product) => product.id === selectedProductId);

  return (
    <div>
      <ProgressHeader eyebrow="템플릿" title="선택만 하면 브랜드가 적용돼요" description="템플릿 선택은 이 기기에 저장되고 빠른 제작과 브랜드 상세 화면에서 이어서 확인할 수 있어요." />
      {selectedProduct ? (
        <SoftCard className="mb-4 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <p className="text-xs font-black text-primary-strong">선택한 상품</p>
          <p className="mt-1 text-lg font-black text-ink">{selectedProduct.title}</p>
          <p className="mt-2 text-xs font-bold text-muted">{selectedProduct.helper}</p>
        </SoftCard>
      ) : null}
      <div className="grid gap-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} selected={selectedTemplateId === template.id} productTitle={printProducts.find((product) => product.id === template.productId)?.title ?? "인쇄물"} onSelect={() => selectTemplate(template.id)} />
        ))}
      </div>
    </div>
  );
}

export function TemplateCard({ template, selected, productTitle, onSelect }: { template: PrintTemplate; selected: boolean; productTitle: string; onSelect: () => void }) {
  return (
    <button className={`rounded-lg border p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 ${selected ? "border-primary bg-surface-blue ring-4 ring-primary-soft" : "border-line bg-surface"}`} type="button" onClick={onSelect}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{productTitle}</span>
        <span className="text-xs font-black text-soft">{selected ? "선택됨" : template.createdAt}</span>
      </div>
      <p className="text-lg font-black tracking-[-0.04em] text-ink">{template.title}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-muted">{template.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {template.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-surface px-3 py-1 text-xs font-black text-primary-strong">#{tag}</span>
        ))}
      </div>
    </button>
  );
}
