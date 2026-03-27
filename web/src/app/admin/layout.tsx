import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Админка</p>
        <p className="text-xs text-zinc-500">
          {user.displayName ?? user.steamId} · полный функционал на этапе 7
        </p>
      </header>
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
