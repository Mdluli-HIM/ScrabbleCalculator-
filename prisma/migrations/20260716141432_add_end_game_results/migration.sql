-- CreateEnum
CREATE TYPE "EndGameReason" AS ENUM ('PLAYER_EMPTIED_RACK', 'STALEMATE');

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "reason" "EndGameReason" NOT NULL,
    "finishingPlayerId" TEXT,
    "totalRackDeduction" INTEGER NOT NULL,
    "hasSharedWin" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_player_results" (
    "id" TEXT NOT NULL,
    "matchResultId" TEXT NOT NULL,
    "matchPlayerId" TEXT NOT NULL,
    "baseScore" INTEGER NOT NULL,
    "rackTileCount" INTEGER NOT NULL,
    "rackDeduction" INTEGER NOT NULL,
    "finishingBonus" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_player_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_remaining_rack_tiles" (
    "id" TEXT NOT NULL,
    "matchPlayerResultId" TEXT NOT NULL,
    "tileOrder" INTEGER NOT NULL,
    "letter" VARCHAR(1) NOT NULL,
    "isBlank" BOOLEAN NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_remaining_rack_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_results_matchId_key" ON "match_results"("matchId");

-- CreateIndex
CREATE INDEX "match_results_finishingPlayerId_idx" ON "match_results"("finishingPlayerId");

-- CreateIndex
CREATE INDEX "match_results_createdAt_idx" ON "match_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "match_player_results_matchPlayerId_key" ON "match_player_results"("matchPlayerId");

-- CreateIndex
CREATE INDEX "match_player_results_matchResultId_rank_idx" ON "match_player_results"("matchResultId", "rank");

-- CreateIndex
CREATE INDEX "match_player_results_isWinner_idx" ON "match_player_results"("isWinner");

-- CreateIndex
CREATE UNIQUE INDEX "match_player_results_matchResultId_matchPlayerId_key" ON "match_player_results"("matchResultId", "matchPlayerId");

-- CreateIndex
CREATE INDEX "match_remaining_rack_tiles_matchPlayerResultId_idx" ON "match_remaining_rack_tiles"("matchPlayerResultId");

-- CreateIndex
CREATE UNIQUE INDEX "match_remaining_rack_tiles_matchPlayerResultId_tileOrder_key" ON "match_remaining_rack_tiles"("matchPlayerResultId", "tileOrder");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_finishingPlayerId_fkey" FOREIGN KEY ("finishingPlayerId") REFERENCES "match_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_player_results" ADD CONSTRAINT "match_player_results_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "match_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_player_results" ADD CONSTRAINT "match_player_results_matchPlayerId_fkey" FOREIGN KEY ("matchPlayerId") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_remaining_rack_tiles" ADD CONSTRAINT "match_remaining_rack_tiles_matchPlayerResultId_fkey" FOREIGN KEY ("matchPlayerResultId") REFERENCES "match_player_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
