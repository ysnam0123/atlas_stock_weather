-- CreateTable
CREATE TABLE "ai_accounts" (
    "id" TEXT NOT NULL,
    "startCapital" DOUBLE PRECISION NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastProcessedDate" DATE,

    CONSTRAINT "ai_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_signals" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "setups" TEXT[],
    "verdict" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "closePrice" DOUBLE PRECISION NOT NULL,
    "stopPrice" DOUBLE PRECISION,
    "targetPrice" DOUBLE PRECISION,
    "shares" INTEGER,
    "riskAmount" DOUBLE PRECISION,
    "reasonKo" TEXT NOT NULL,
    "exitPlanKo" TEXT,
    "note" TEXT,
    "positionId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_positions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "signalId" TEXT,
    "symbol" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "entryDate" DATE NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "pendingExit" TEXT,
    "exitDate" DATE,
    "exitPrice" DOUBLE PRECISION,
    "exitReason" TEXT,
    "pnl" DOUBLE PRECISION,

    CONSTRAINT "ai_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_equity" (
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "positionsValue" DOUBLE PRECISION NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ai_equity_pkey" PRIMARY KEY ("accountId","date")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "my_equity" (
    "date" DATE NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "marketValue" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "my_equity_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "ai_signals_accountId_date_idx" ON "ai_signals"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_signals_accountId_date_symbol_side_key" ON "ai_signals"("accountId", "date", "symbol", "side");

-- CreateIndex
CREATE INDEX "ai_positions_accountId_status_idx" ON "ai_positions"("accountId", "status");

-- CreateIndex
CREATE INDEX "trades_date_idx" ON "trades"("date");

-- AddForeignKey
ALTER TABLE "ai_signals" ADD CONSTRAINT "ai_signals_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ai_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_positions" ADD CONSTRAINT "ai_positions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ai_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_equity" ADD CONSTRAINT "ai_equity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ai_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
