-- CreateEnum
CREATE TYPE "Market" AS ENUM ('us', 'kr');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('running', 'success', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('clear', 'cloudy', 'rain');

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'us',
    "status" "RunStatus" NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ,
    "error" TEXT,
    "claudeCostUsd" DECIMAL(10,4),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_outputs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "status" "SkillStatus" NOT NULL,
    "rawJson" JSONB,
    "rawMd" TEXT,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'us',
    "tradeDate" DATE NOT NULL,
    "runId" TEXT NOT NULL,
    "marketScore" DOUBLE PRECISION,
    "breadthZone" TEXT,
    "uptrendRatio" DOUBLE PRECISION,
    "uptrendScore" DOUBLE PRECISION,
    "uptrendZone" TEXT,
    "exposureCeiling" INTEGER,
    "recommendation" TEXT,
    "condition" "Condition",
    "summaryKo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_snapshots" (
    "id" TEXT NOT NULL,
    "market" "Market" NOT NULL DEFAULT 'us',
    "tradeDate" DATE NOT NULL,
    "runId" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "uptrendRatio" DOUBLE PRECISION NOT NULL,
    "trend" TEXT,
    "slope" DOUBLE PRECISION,
    "status" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sector_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "runs_kind_startedAt_idx" ON "runs"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "skill_outputs_runId_idx" ON "skill_outputs"("runId");

-- CreateIndex
CREATE INDEX "skill_outputs_skillId_createdAt_idx" ON "skill_outputs"("skillId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "market_snapshots_market_tradeDate_key" ON "market_snapshots"("market", "tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "sector_snapshots_market_tradeDate_sector_key" ON "sector_snapshots"("market", "tradeDate", "sector");

-- AddForeignKey
ALTER TABLE "skill_outputs" ADD CONSTRAINT "skill_outputs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
