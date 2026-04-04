import TradePageClient from "@/app/trade/trade-client";
import { getSessionUser } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  steam_invalid_mode: "Вход через Steam прерван. Попробуйте снова.",
  steam_not_valid: "Steam не подтвердил вход. Попробуйте снова.",
  steam_no_claimed_id: "Некорректный ответ Steam. Попробуйте позже.",
  steam_bad_claimed_id: "Некорректный идентификатор Steam.",
  banned: "Аккаунт заблокирован.",
  session_config: "На сервере не настроена сессия (SESSION_SECRET). Обратитесь к администратору.",
};

type Props = {
  searchParams: Promise<{ error?: string; signed_in?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const errorKey = sp.error;
  const authError = errorKey ? ERROR_MESSAGES[errorKey] ?? `Ошибка: ${errorKey}` : null;
  const signedInNotice = sp.signed_in === "1" && !!user;

  return (
    <TradePageClient authError={authError} signedInNotice={signedInNotice} />
  );
}
