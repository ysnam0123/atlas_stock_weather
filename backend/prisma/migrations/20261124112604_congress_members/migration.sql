-- CreateTable
CREATE TABLE "congress_members" (
    "bioguide" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" INTEGER NOT NULL,
    "committees" TEXT[],
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "congress_members_pkey" PRIMARY KEY ("bioguide")
);

-- CreateIndex
CREATE INDEX "congress_members_state_district_idx" ON "congress_members"("state", "district");
