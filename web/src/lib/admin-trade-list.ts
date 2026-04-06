import type { Prisma, TradeStatus } from "@prisma/client";

/** Maps admin UI tab `status` query to Prisma where (same as /admin/trades tabs). */
export function tradeWhereFromAdminStatusTab(status: string | undefined): Prisma.TradeWhereInput {
  if (!status || status === "all") return {};
  if (status === "accepted") return { status: "accepted_by_admin" };
  const allowed: TradeStatus[] = [
    "pending",
    "accepted_by_admin",
    "rejected",
    "completed",
    "cancelled",
  ];
  if (allowed.includes(status as TradeStatus)) return { status: status as TradeStatus };
  return {};
}
