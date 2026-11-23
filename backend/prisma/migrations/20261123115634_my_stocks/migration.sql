-- CreateEnum
CREATE TYPE "SymbolType" AS ENUM ('stock', 'etf');

-- CreateTable
CREATE TABLE "symbols" (
    "symbol" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'us',
    "exchange" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameKo" TEXT,
    "type" "SymbolType" NOT NULL,
    "aliases" TEXT[],
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "symbols_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "holdings" (
    "symbol" TEXT NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "avgCost" DOUBLE PRECISION NOT NULL,
    "stopPrice" DOUBLE PRECISION,
    "stopMethod" TEXT,
    "targetPrice" DOUBLE PRECISION,
    "note" TEXT,
    "openedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "watchlist" (
    "symbol" TEXT NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "price_bars" (
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "price_bars_pkey" PRIMARY KEY ("symbol","date")
);

-- CreateIndex
CREATE INDEX "symbols_nameEn_idx" ON "symbols"("nameEn");

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "symbols"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "symbols"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;
