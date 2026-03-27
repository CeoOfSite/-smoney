export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Панель администратора</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Здесь позже появятся заявки, пользователи и баны (этап 7). Сейчас защищённый вход через Steam и флаг{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">isAdmin</code> в базе.
      </p>
    </main>
  );
}
