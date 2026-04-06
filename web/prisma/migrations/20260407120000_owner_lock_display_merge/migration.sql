-- AlterTable
ALTER TABLE "OwnerManualTradeLockList" ADD COLUMN IF NOT EXISTS "lockDisplayItems" JSONB;
