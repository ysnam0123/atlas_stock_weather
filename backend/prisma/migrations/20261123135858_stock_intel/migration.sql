-- CreateTable
CREATE TABLE "news_items" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleKo" TEXT,
    "importance" TEXT,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earnings_facts" (
    "symbol" TEXT NOT NULL,
    "periodEnd" DATE NOT NULL,
    "fiscal" TEXT NOT NULL,
    "derived" BOOLEAN NOT NULL,
    "revenue" DOUBLE PRECISION,
    "netIncome" DOUBLE PRECISION,
    "epsDiluted" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "operatingMargin" DOUBLE PRECISION,
    "netMargin" DOUBLE PRECISION,
    "revenueYoy" DOUBLE PRECISION,
    "epsYoy" DOUBLE PRECISION,
    "form" TEXT,
    "filed" DATE,

    CONSTRAINT "earnings_facts_pkey" PRIMARY KEY ("symbol","periodEnd")
);

-- CreateTable
CREATE TABLE "congress_docs" (
    "docId" TEXT NOT NULL,
    "member" TEXT NOT NULL,
    "district" TEXT,
    "filed" DATE NOT NULL,
    "processedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "congress_docs_pkey" PRIMARY KEY ("docId")
);

-- CreateTable
CREATE TABLE "congress_trades" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "ticker" TEXT,
    "asset" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "tradeDate" DATE,
    "amount" TEXT NOT NULL,
    "amountLow" INTEGER,
    "amountHigh" INTEGER,
    "owner" TEXT,

    CONSTRAINT "congress_trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "news_items_symbol_publishedAt_idx" ON "news_items"("symbol", "publishedAt");

-- CreateIndex
CREATE INDEX "congress_trades_ticker_idx" ON "congress_trades"("ticker");

-- AddForeignKey
ALTER TABLE "congress_trades" ADD CONSTRAINT "congress_trades_docId_fkey" FOREIGN KEY ("docId") REFERENCES "congress_docs"("docId") ON DELETE CASCADE ON UPDATE CASCADE;
