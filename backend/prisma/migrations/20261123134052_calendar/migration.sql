-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "epsEstimated" DOUBLE PRECISION,
    "revenueEstimated" DOUBLE PRECISION,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_type_symbol_date_key" ON "calendar_events"("type", "symbol", "date");
