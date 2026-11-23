-- AlterTable
ALTER TABLE "market_snapshots" ADD COLUMN     "ftdState" TEXT,
ADD COLUMN     "regime" TEXT,
ADD COLUMN     "topRiskScore" DOUBLE PRECISION,
ADD COLUMN     "topRiskZone" TEXT;
