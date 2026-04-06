"use client";

import { useCallback, useEffect, useState } from "react";

interface LockMeta {
  loadedFromDb: boolean;
  assetIdCount: number;
  classInstanceKeyCount: number;
  lockDisplayItemCount: number;
  count?: number;
  updatedAt: string | null;
  sampleAssetIds: string[];
  sampleClassInstanceKeys: string[];
  fileFallbackPath: string | null;
  classInstanceOnlyEnv?: string;
}

interface DiagnoseResult {
  inventoryItemCount: number;
  matchedByAssetIdCount: number;
  matchedByClassInstanceKeyCount: number;
  matchedClassButNotAssetIdCount: number;
  wouldLockCount: number;
  sampleLockedNames: string[];
  sampleRuleAssetIdsMissingInInventory: string[];
  sampleRuleClassKeysMissingInInventory: string[];
}

export default function AdminLockedSkinsPage() {
  const [meta, setMeta] = useState<LockMeta | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [diagnose, setDiagnose] = useState<DiagnoseResult | null>(null);
  const [diagnoseErr, setDiagnoseErr] = useState("");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const res = await fetch("/api/admin/owner-trade-lock");
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      setMeta({
        loadedFromDb: !!data.loadedFromDb,
        assetIdCount: Number(data.assetIdCount ?? data.count ?? 0),
        classInstanceKeyCount: Number(data.classInstanceKeyCount ?? 0),
        lockDisplayItemCount: Number(data.lockDisplayItemCount ?? 0),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
        sampleAssetIds: Array.isArray(data.sampleAssetIds)
          ? (data.sampleAssetIds as string[])
          : Array.isArray(data.sampleIds)
            ? (data.sampleIds as string[])
            : [],
        sampleClassInstanceKeys: Array.isArray(data.sampleClassInstanceKeys)
          ? (data.sampleClassInstanceKeys as string[])
          : [],
        fileFallbackPath: typeof data.fileFallbackPath === "string" ? data.fileFallbackPath : null,
        classInstanceOnlyEnv:
          typeof data.classInstanceOnlyEnv === "string" ? data.classInstanceOnlyEnv : undefined,
      });
    } else {
      setErr("Не удалось загрузить статус");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveFromTextarea() {
    if (!jsonText.trim()) {
      setErr("Вставьте JSON из ответа Steam (например блок с «assets»)");
      return;
    }
    setSaving(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/admin/owner-trade-lock", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonText }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(
        typeof data.message === "string"
          ? data.message
          : `Сохранено: ${data.assetIdCount ?? data.count} asset id, ${data.classInstanceKeyCount ?? 0} пар classid+instanceid`,
      );
      setJsonText("");
      load();
    } else {
      setErr(data.message ?? data.error ?? "Ошибка сохранения");
    }
    setSaving(false);
  }

  async function handleClearDb() {
    if (!window.confirm("Удалить список из БД? Будет использован файл на сервере (если настроен).")) return;
    setSaving(true);
    setMsg("");
    setErr("");
    const res = await fetch("/api/admin/owner-trade-lock", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(data.message ?? "Сброшено");
      load();
    } else {
      setErr(data.error ?? "Ошибка");
    }
    setSaving(false);
  }

  async function runDiagnose() {
    setDiagnoseLoading(true);
    setDiagnose(null);
    setDiagnoseErr("");
    const res = await fetch("/api/admin/owner-trade-lock?diagnose=1");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDiagnoseErr(
        typeof data.diagnoseError === "string"
          ? `Инвентарь магазина: ${data.diagnoseError}`
          : data.error ?? "Ошибка диагностики",
      );
      setDiagnoseLoading(false);
      return;
    }
    if (data.diagnose && typeof data.diagnose === "object") {
      setDiagnose(data.diagnose as DiagnoseResult);
    }
    setDiagnoseLoading(false);
  }

  function onPickFile(f: File | null) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const t = typeof r.result === "string" ? r.result : "";
      setJsonText(t);
      setMsg(`Файл «${f.name}» загружен в поле — нажмите «Сохранить в БД»`);
    };
    r.readAsText(f, "UTF-8");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Трейдлок (ручной список)</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Вставьте сырой JSON из браузера (Network → ответ Steam): и отформатированный, и минифицированный подходят.
          Логин Steam на сервере не нужен. Список действует только на инвентарь <strong className="text-zinc-800 dark:text-zinc-200">магазина</strong> (колонка «Вы получаете»), тот же Steam ID, что в <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">OWNER_STEAM_ID</code>.
          Не включайте на Render <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">OWNER_INVENTORY_CONTEXT_ID=16</code>: с датацентра Steam почти не отдаёт контекст 16 (пустой JSON / private / лимиты), инвентарь магазина пропадёт. Браузер с вашей сессией и сервер — разные условия.           Сайт грузит магазин с контекста <strong>2</strong>. Сначала матчим <code className="text-xs">classid+instanceid</code>, потом <code className="text-xs">assetid</code> (у разных контекстов Steam asset id часто разный). Если в диагностике совпадений 0 — JSON не тот аккаунт или пары class+instance в контексте 2 другие. Опционально на Render:{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY=true</code> — не использовать asset id из списка, только пары class+instance (если в БД они заполнены).
          После обновления сайта нажмите «Сохранить в БД» ещё раз с тем же JSON. Список в БД перекрывает файл{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">data/owner-manual-trade-lock.json</code>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : meta ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Источник:</span>{" "}
            {meta.loadedFromDb ? (
              <span className="text-emerald-700 dark:text-emerald-400">База данных</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">Только файл / env (записи в БД нет)</span>
            )}
          </p>
          <p className="mt-1">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">По asset id:</span> {meta.assetIdCount}
          </p>
          <p className="mt-1">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">По classid+instanceid:</span>{" "}
            {meta.classInstanceKeyCount}
          </p>
          <p className="mt-1">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">В едином списке на сайте (нормализовано):</span>{" "}
            {meta.lockDisplayItemCount}
          </p>
          {meta.updatedAt ? (
            <p className="mt-1 text-zinc-500">Обновлено: {new Date(meta.updatedAt).toLocaleString()}</p>
          ) : null}
          {meta.sampleAssetIds.length > 0 ? (
            <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Примеры asset id: {meta.sampleAssetIds.join(", ")}
              {meta.assetIdCount > meta.sampleAssetIds.length ? " …" : ""}
            </p>
          ) : null}
          {meta.sampleClassInstanceKeys.length > 0 ? (
            <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Примеры class_instance: {meta.sampleClassInstanceKeys.join(", ")}
              {meta.classInstanceKeyCount > meta.sampleClassInstanceKeys.length ? " …" : ""}
            </p>
          ) : null}
          {meta.fileFallbackPath ? (
            <p className="mt-2 text-xs text-zinc-500">
              Файл на сервере найден: <code className="break-all">{meta.fileFallbackPath}</code> — используется, если нет
              записи в БД.
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Файл трейдлока на сервере не найден (или путь не задан).</p>
          )}
          {meta.classInstanceOnlyEnv ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Env <code className="text-[10px]">OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY</code>={meta.classInstanceOnlyEnv}
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              <code className="text-[10px]">OWNER_MANUAL_TRADE_LOCK_CLASS_INSTANCE_ONLY</code> не задан (учитываются и asset id, и class+instance).
            </p>
          )}
          <button
            type="button"
            disabled={diagnoseLoading}
            onClick={runDiagnose}
            className="mt-3 rounded-lg border border-zinc-400 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {diagnoseLoading ? "Запрос к Steam…" : "Диагностика: совпадения с живым инвентарём магазина"}
          </button>
        </div>
      ) : null}

      {diagnoseErr ? <p className="text-sm text-red-600 dark:text-red-400">{diagnoseErr}</p> : null}
      {diagnose ? (
        <div className="rounded-2xl border border-blue-900/40 bg-blue-950/30 p-5 text-sm dark:border-blue-800/50">
          <p className="font-semibold text-blue-200">Результат диагностики (сейчас с Steam)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
            <li>Предметов в инвентаре магазина: {diagnose.inventoryItemCount}</li>
            <li>Совпало по asset id: {diagnose.matchedByAssetIdCount}</li>
            <li>Совпало по classid+instanceid: {diagnose.matchedByClassInstanceKeyCount}</li>
            <li>
              Совпало по class+instance, но asset id из JSON другой: {diagnose.matchedClassButNotAssetIdCount}{" "}
              <span className="text-zinc-500">(типично для JSON с context 16 vs инвентарь context 2)</span>
            </li>
            <li className="font-medium text-amber-200">Будет помечено как locked: {diagnose.wouldLockCount}</li>
          </ul>
          {diagnose.sampleLockedNames.length > 0 ? (
            <p className="mt-2 text-xs text-zinc-400">Примеры имён: {diagnose.sampleLockedNames.join(" · ")}</p>
          ) : null}
          {diagnose.sampleRuleAssetIdsMissingInInventory.length > 0 ? (
            <p className="mt-2 break-all font-mono text-[10px] text-red-300">
              Asset id из списка, которых нет в инвентаре (первые):{" "}
              {diagnose.sampleRuleAssetIdsMissingInInventory.join(", ")}
            </p>
          ) : null}
          {diagnose.sampleRuleClassKeysMissingInInventory.length > 0 ? (
            <p className="mt-2 break-all font-mono text-[10px] text-red-300">
              Пары class_instance из списка, которых нет в инвентаре (первые):{" "}
              {diagnose.sampleRuleClassKeysMissingInInventory.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">JSON из Steam</label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={14}
          placeholder='{ "assets": [ { "assetid": "50881305496", ... }, ... ] }'
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
            Выбрать файл…
            <input
              type="file"
              accept=".json,application/json,text/plain"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveFromTextarea}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Сохранение…" : "Сохранить в БД"}
          </button>
          <button
            type="button"
            disabled={saving || !meta?.loadedFromDb}
            onClick={handleClearDb}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Сбросить БД
          </button>
        </div>
      </div>

      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
    </main>
  );
}
