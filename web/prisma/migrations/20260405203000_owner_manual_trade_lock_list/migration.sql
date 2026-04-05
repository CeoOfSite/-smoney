-- CreateTable
CREATE TABLE "OwnerManualTradeLockList" (
    "id" TEXT NOT NULL,
    "assetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerManualTradeLockList_pkey" PRIMARY KEY ("id")
);
