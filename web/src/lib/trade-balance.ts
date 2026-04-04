/**
 * Guest ↔ owner trade value rules (amounts in cents, same as resolvePrice.priceUsd).
 */

export const TRADE_MAX_OVERPAY_PERCENT = 5;

/** Max selected items per side (guest / owner) in one trade offer. */
export const MAX_TRADE_ITEMS_PER_SIDE = 30;

/** Max total value guest may give when owner side is ownerTotalCents (inclusive cap). */
export function maxGuestTotalCentsAtOverpayCap(ownerTotalCents: number): number {
  return Math.round((ownerTotalCents * (100 + TRADE_MAX_OVERPAY_PERCENT)) / 100);
}

export function tradeOverpayPercent(guestTotalCents: number, ownerTotalCents: number): number | null {
  if (ownerTotalCents <= 0) return null;
  return ((guestTotalCents - ownerTotalCents) / ownerTotalCents) * 100;
}

export type TradeBalanceCheck =
  | { ok: true }
  | { ok: false; reason: "no_pricing"; message: string }
  | { ok: false; reason: "overpay_too_low"; shortfallCents: number; message: string }
  | { ok: false; reason: "overpay_too_high"; excessCents: number; message: string };

export function checkTradeBalance(guestTotalCents: number, ownerTotalCents: number): TradeBalanceCheck {
  if (guestTotalCents <= 0 || ownerTotalCents <= 0) {
    return {
      ok: false,
      reason: "no_pricing",
      message:
        "Нельзя отправить обмен: нет оценки стоимости выбранных предметов (UNAVAILABLE или нулевая цена).",
    };
  }

  if (guestTotalCents < ownerTotalCents) {
    const shortfallCents = ownerTotalCents - guestTotalCents;
    return {
      ok: false,
      reason: "overpay_too_low",
      shortfallCents,
      message: `Переплата ниже 0%. Добавьте предметы с вашей стороны или уберите с нашей на сумму не меньше ${(shortfallCents / 100).toFixed(2)} USD.`,
    };
  }

  const maxGuest = maxGuestTotalCentsAtOverpayCap(ownerTotalCents);
  if (guestTotalCents > maxGuest) {
    const excessCents = guestTotalCents - maxGuest;
    return {
      ok: false,
      reason: "overpay_too_high",
      excessCents,
      message: `Переплата выше ${TRADE_MAX_OVERPAY_PERCENT}%. Уменьшите её на ${(excessCents / 100).toFixed(2)} USD: уберите предметы с вашей стороны или добавьте с нашей (макс. ${TRADE_MAX_OVERPAY_PERCENT}%).`,
    };
  }

  return { ok: true };
}
