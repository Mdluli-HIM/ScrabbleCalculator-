-- CreateEnum
CREATE TYPE "ExperiencePhase" AS ENUM ('OPENING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ExperienceCloseness" AS ENUM ('UNSET', 'TIGHT', 'COMPETITIVE', 'OPEN');

-- CreateEnum
CREATE TYPE "ExperienceRankMovement" AS ENUM ('NEW', 'UP', 'DOWN', 'SAME');

-- CreateEnum
CREATE TYPE "ExperienceMomentum" AS ENUM ('NEW', 'SURGING', 'BUILDING', 'STEADY', 'COOLING');

-- CreateEnum
CREATE TYPE "ExperienceEventType" AS ENUM ('LEAD_CHANGE', 'SHARED_LEAD', 'RANK_RISE', 'COMEBACK', 'MOMENTUM_SHIFT');

-- CreateTable
CREATE TABLE "match_experience_snapshots" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "turnId" TEXT,
    "turnNumber" INTEGER NOT NULL,
    "phase" "ExperiencePhase" NOT NULL,
    "closeness" "ExperienceCloseness" NOT NULL,
    "hasSharedLead" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_experience_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_experience_standings" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "matchPlayerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "movement" "ExperienceRankMovement" NOT NULL,
    "momentum" "ExperienceMomentum" NOT NULL,
    "isLeader" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_experience_standings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_experience_events" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "type" "ExperienceEventType" NOT NULL,
    "matchPlayerId" TEXT NOT NULL,
    "relatedMatchPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_experience_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_experience_snapshots_turnId_key" ON "match_experience_snapshots"("turnId");

-- CreateIndex
CREATE INDEX "match_experience_snapshots_matchId_createdAt_idx" ON "match_experience_snapshots"("matchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_experience_snapshots_matchId_turnNumber_key" ON "match_experience_snapshots"("matchId", "turnNumber");

-- CreateIndex
CREATE INDEX "match_experience_standings_matchPlayerId_idx" ON "match_experience_standings"("matchPlayerId");

-- CreateIndex
CREATE INDEX "match_experience_standings_snapshotId_rank_idx" ON "match_experience_standings"("snapshotId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "match_experience_standings_snapshotId_matchPlayerId_key" ON "match_experience_standings"("snapshotId", "matchPlayerId");

-- CreateIndex
CREATE INDEX "match_experience_events_snapshotId_idx" ON "match_experience_events"("snapshotId");

-- CreateIndex
CREATE INDEX "match_experience_events_matchPlayerId_idx" ON "match_experience_events"("matchPlayerId");

-- CreateIndex
CREATE INDEX "match_experience_events_relatedMatchPlayerId_idx" ON "match_experience_events"("relatedMatchPlayerId");

-- CreateIndex
CREATE INDEX "match_experience_events_type_idx" ON "match_experience_events"("type");

-- AddForeignKey
ALTER TABLE "match_experience_snapshots" ADD CONSTRAINT "match_experience_snapshots_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_snapshots" ADD CONSTRAINT "match_experience_snapshots_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_standings" ADD CONSTRAINT "match_experience_standings_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "match_experience_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_standings" ADD CONSTRAINT "match_experience_standings_matchPlayerId_fkey" FOREIGN KEY ("matchPlayerId") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_events" ADD CONSTRAINT "match_experience_events_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "match_experience_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_events" ADD CONSTRAINT "match_experience_events_matchPlayerId_fkey" FOREIGN KEY ("matchPlayerId") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_experience_events" ADD CONSTRAINT "match_experience_events_relatedMatchPlayerId_fkey" FOREIGN KEY ("relatedMatchPlayerId") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
