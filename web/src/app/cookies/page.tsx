import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy — ChezTrading",
  description: "How ChezTrading uses cookies and local storage",
};

export default function CookiesPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-10 text-zinc-300 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-xs font-medium text-amber-500/90 hover:text-amber-400">
          ← Home
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-amber-500">Cookie Policy</h1>
        <p className="mt-2 text-xs text-zinc-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-zinc-400">
          <h2 className="text-base font-semibold text-zinc-200">English</h2>
          <p>
            ChezTrading uses <strong className="text-zinc-300">essential HTTP cookies</strong> to keep you signed in after
            Steam OpenID authentication (session cookie). Without this cookie, login cannot be maintained.
          </p>
          <p>
            We also use <strong className="text-zinc-300">browser local storage</strong> on your device to remember your
            interface language and display currency preferences. This data stays in your browser and is not used for
            advertising.
          </p>
          <p>We do not use third-party advertising or analytics cookies on this policy baseline. If that changes, we will update this page.</p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-zinc-400">
          <h2 className="text-base font-semibold text-zinc-200">Русский</h2>
          <p>
            ChezTrading использует <strong className="text-zinc-300">необходимые HTTP-cookie</strong>, чтобы сохранять
            ваш вход после авторизации через Steam (сессионная cookie). Без неё вход не может поддерживаться.
          </p>
          <p>
            Также используется <strong className="text-zinc-300">локальное хранилище браузера</strong> для запоминания
            языка интерфейса и отображаемой валюты. Данные остаются на вашем устройстве и не используются для рекламы.
          </p>
          <p>Сторонние рекламные или аналитические cookie в базовой конфигурации не применяются. При изменениях страница будет обновлена.</p>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-zinc-400">
          <h2 className="text-base font-semibold text-zinc-200">中文</h2>
          <p>
            ChezTrading 使用<strong className="text-zinc-300">必要的 HTTP Cookie</strong>，在通过 Steam 登录后维持您的会话。
            没有该 Cookie 将无法保持登录状态。
          </p>
          <p>
            我们还在您的浏览器中使用<strong className="text-zinc-300">本地存储</strong>以记住界面语言和显示货币偏好。
            这些数据保留在您的设备上，不用于广告。
          </p>
          <p>当前基础版本不使用第三方广告或分析 Cookie。如有变更，将更新本页面。</p>
        </section>

        <p className="mt-10 text-center text-xs text-zinc-600">
          Questions: <span className="text-zinc-500">support@cheztrading.com</span>
        </p>
      </div>
    </div>
  );
}
