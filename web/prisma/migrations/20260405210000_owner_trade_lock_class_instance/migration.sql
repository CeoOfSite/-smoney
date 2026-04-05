-- AlterTable: match manual lock by classid+instanceid when assetid differs across Steam contexts (e.g. 16 vs 2)
ALTER TABLE "OwnerManualTradeLockList" ADD COLUMN "classInstanceKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
