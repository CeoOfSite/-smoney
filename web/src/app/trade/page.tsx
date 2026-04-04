import { redirect } from "next/navigation";

/** Старый путь /trade — редирект на главную (интерфейс обмена на `/`). */
export default function TradeRedirectPage() {
  redirect("/");
}
