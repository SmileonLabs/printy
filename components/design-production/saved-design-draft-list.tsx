"use client";

import { AppButton } from "@/components/ui";

export type SavedDesignDraftOption = {
  id: string;
  label: string;
};

type SavedDesignDraftListProps = {
  title: string;
  description?: string;
  options: SavedDesignDraftOption[];
  selectedId?: string;
  loadLabel?: string;
  deleteLabel?: string;
  onSelect: (id: string) => void;
  onLoad: () => void;
  onDelete?: () => void;
};

export function SavedDesignDraftList({ title, description, options, selectedId, loadLabel = "불러오기", deleteLabel = "삭제", onSelect, onLoad, onDelete }: SavedDesignDraftListProps) {
  if (options.length === 0) {
    return null;
  }

  const hasSelected = Boolean(selectedId);

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 shadow-soft">
      <div>
        <p className="text-xs font-black text-ink">{title}</p>
        {description ? <p className="mt-1 text-[11px] font-bold leading-5 text-muted">{description}</p> : null}
      </div>
      <div className={`grid gap-2 ${onDelete ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
        <select className="min-h-10 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" value={selectedId ?? ""} onChange={(event) => onSelect(event.target.value)}>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <AppButton className="py-2 text-xs" variant="secondary" onClick={onLoad} disabled={!hasSelected}>{loadLabel}</AppButton>
        {onDelete ? <AppButton className="py-2 text-xs text-danger disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" variant="ghost" onClick={onDelete} disabled={!hasSelected}>{deleteLabel}</AppButton> : null}
      </div>
    </div>
  );
}
