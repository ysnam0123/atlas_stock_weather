-- AlterTable
ALTER TABLE "ai_signals" ADD COLUMN     "commentKo" TEXT;

-- CreateTable
CREATE TABLE "commentaries" (
    "id" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'us',
    "tradeDate" DATE NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT[],
    "why" TEXT[],
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commentaries_market_tradeDate_key" ON "commentaries"("market", "tradeDate");
