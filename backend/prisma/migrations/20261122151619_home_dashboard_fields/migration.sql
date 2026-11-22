-- AlterTable
ALTER TABLE "market_snapshots" ADD COLUMN     "breadthComponents" JSONB,
ADD COLUMN     "exposureConfidence" TEXT,
ADD COLUMN     "exposureMissing" TEXT[],
ADD COLUMN     "exposureScore" DOUBLE PRECISION,
ADD COLUMN     "uptrendMedian" DOUBLE PRECISION,
ADD COLUMN     "uptrendPercentile" DOUBLE PRECISION;
