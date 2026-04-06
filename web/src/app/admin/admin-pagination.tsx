"use client";

import { useMemo } from "react";

function visiblePageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  disabled?: boolean;
};

export function AdminPagination({ page, totalPages, onPageChange, disabled }: Props) {
  const items = useMemo(() => visiblePageItems(page, totalPages), [page, totalPages]);

  if (totalPages < 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Назад
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {items.map((item, i) =>
          item === "gap" ? (
            <span key={`g-${i}`} className="px-1 text-zinc-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(item)}
              className={
                item === page
                  ? "min-w-[2.25rem] rounded-lg bg-zinc-900 px-2.5 py-1.5 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "min-w-[2.25rem] rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }
            >
              {item}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Вперёд
      </button>
    </div>
  );
}
