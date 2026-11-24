-- CreateTable
CREATE TABLE "stock_reports" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,

    CONSTRAINT "stock_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_reports_symbol_createdAt_idx" ON "stock_reports"("symbol", "createdAt");
