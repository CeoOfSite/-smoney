import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-8 text-zinc-300 sm:px-6 sm:py-12">
      <article className="mx-auto w-full max-w-[56rem]">
        <Link href="/" className="text-xs font-medium text-amber-500/90 hover:text-amber-400">
          ← Home
        </Link>
        <header className="mt-6 border-b border-zinc-800/80 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-amber-500 sm:text-4xl">{title}</h1>
        </header>
        <div className="mt-8 space-y-10 text-[15px] leading-[1.7] text-zinc-400 [&_strong]:font-semibold [&_strong]:text-zinc-300">
          {children}
        </div>
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
