"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AdminPagination } from "@/app/admin/admin-pagination";
import { serializeTradeSummary } from "@/lib/trade-api-serialize";

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    pending: "Ожидает",
    accepted_by_admin: "Принято",
    rejected: "Отклонено",
    completed: "Завершено",
    cancelled: "Отменено",
  };
  return m[s] ?? s;
}

function fmtUsd(cents: number): string {
  return `${(cents / 100).toFixed(2)} USD`;
}

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "pending", label: "Ожидают" },
  { key: "accepted", label: "Принято" },
  { key: "rejected", label: "Отклонено" },
  { key: "completed", label: "Завершено" },
];

type Row = ReturnType<typeof serializeTradeSummary> & {
  creatorSteamId: string;
  creatorDisplayName: string | null;
};

export default function AdminTradesClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp.toString();

  const filter = sp.get("status") ?? "all";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setTab = useCallback(
    (key: string) => {
      if (key === "all") {
        router.replace("/admin/trades", { scroll: false });
        return;
      }
      const params = new URLSearchParams();
      params.set("status", key);
      params.set("page", "1");
      router.replace(`/admin/trades?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const setPage = useCallback(
    (p: number) => {
      const params = new URLSearchParams(spKey);
      if (filter && filter !== "all") params.set("status", filter);
      else params.delete("status");
      if (p <= 1) params.delete("page");
      else params.set("page", String(p));
      const qs = params.toString();
      router.replace(qs ? `/admin/trades?${qs}` : "/admin/trades", { scroll: false });
    },
    [router, spKey, filter],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const status = sp.get("status") ?? "all";
        const p = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
        const res = await fetch(
          `/api/trades?page=${p}&limit=20&status=${encodeURIComponent(status)}`,
          { credentials: "include" },
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setError("Нет доступа");
          setRows([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "Ошибка загрузки");
          setRows([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        const list = Array.isArray(data?.data) ? (data.data as Row[]) : [];
        setRows(list);
        setTotal(typeof data?.total === "number" ? data.total : 0);
        setTotalPages(typeof data?.totalPages === "number" ? Math.max(1, data.totalPages) : 1);
      } catch {
        if (!cancelled) setError("Сеть недоступна");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spKey]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Заявки на обмен</h1>
        <p className="text-sm text-zinc-500">
          {loading ? "Загрузка…" : `Всего: ${total}`}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Пользователь</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3 text-right">Отдаёт (гость)</th>
              <th className="px-4 py-3 text-right">Получает (магазин)</th>
              <th className="px-4 py-3 text-right">Предм.</th>
            </tr>
          </thead>
          <tbody>
            {!loading
              ? rows.map((tr) => (
                  <tr key={tr.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/trades/${tr.id}`}
                        className="font-mono text-xs text-amber-700 hover:underline dark:text-amber-400"
                        title={tr.id}
                      >
                        {tr.id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-zinc-800 dark:text-zinc-200">
                      {tr.creatorDisplayName ?? "—"}
                      <span className="block font-mono text-[11px] text-zinc-500">{tr.creatorSteamId}</span>
                    </td>
                    <td className="px-4 py-2">{statusLabel(tr.status)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(tr.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtUsd(tr.guestTotalCents)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtUsd(tr.ownerTotalCents)}</td>
                    <td className="px-4 py-2 text-right text-zinc-500">{tr.itemCount}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Загрузка…</p>
        ) : null}
        {!loading && rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Нет заявок в этом фильтре.</p>
        ) : null}
        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
      </div>
    </main>
  );
}
