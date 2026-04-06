import { Suspense } from "react";

import AdminTradesClient from "@/app/admin/trades/admin-trades-client";

export const dynamic = "force-dynamic";

export default function AdminTradesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl space-y-6">
          <p className="text-sm text-zinc-500">Загрузка…</p>
        </main>
      }
    >
      <AdminTradesClient />
    </Suspense>
  );
}
