-- CreateTable
CREATE TABLE "premarket_snapshots" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "takenAt" TIMESTAMPTZ NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceAt" TIMESTAMPTZ NOT NULL,
    "prevClose" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "premarket_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "premarket_snapshots_symbol_sessionDate_key" ON "premarket_snapshots"("symbol", "sessionDate");
