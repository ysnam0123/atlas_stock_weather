-- AlterTable
ALTER TABLE "ai_accounts" ADD COLUMN     "ruleVersion" TEXT NOT NULL DEFAULT 'v1';

-- AlterTable
ALTER TABLE "ai_positions" ADD COLUMN     "breakeven" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "targetPrice" DROP NOT NULL;
