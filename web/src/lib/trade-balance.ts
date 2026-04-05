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
  | { ok: false; reason: "no_pricing" }
  | { ok: false; reason: "overpay_too_low"; shortfallCents: number }
  | { ok: false; reason: "overpay_too_high"; excessCents: number };

/**
 * Amounts are USD cents; UI must format with the user's display currency (fmt) + i18n — do not hardcode USD in copy.
 */
export function checkTradeBalance(guestTotalCents: number, ownerTotalCents: number): TradeBalanceCheck {
  if (guestTotalCents <= 0 || ownerTotalCents <= 0) {
    return { ok: false, reason: "no_pricing" };
  }

  if (guestTotalCents < ownerTotalCents) {
    const shortfallCents = ownerTotalCents - guestTotalCents;
    return { ok: false, reason: "overpay_too_low", shortfallCents };
  }

  const maxGuest = maxGuestTotalCentsAtOverpayCap(ownerTotalCents);
  if (guestTotalCents > maxGuest) {
    const excessCents = guestTotalCents - maxGuest;
    return { ok: false, reason: "overpay_too_high", excessCents };
  }

  return { ok: true };
}
