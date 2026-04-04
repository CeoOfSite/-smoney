-- AlterTable: optional fixed price + optional per-asset markup %
ALTER TABLE "OwnerManualPrice" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE "OwnerManualPrice" ADD COLUMN "markupPercent" DOUBLE PRECISION;
ALTER TABLE "OwnerManualPrice" ALTER COLUMN "priceUsd" DROP NOT NULL;
