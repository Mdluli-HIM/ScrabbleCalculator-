-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DictionaryPolicy" AS ENUM ('OXFORD_ONLY', 'TOURNAMENT_LEXICON_ONLY', 'BOTH_REQUIRED', 'EITHER_ACCEPTED');

-- CreateEnum
CREATE TYPE "MatchOwnerType" AS ENUM ('REGISTERED_USER', 'GUEST_SESSION');

-- CreateEnum
CREATE TYPE "MatchPlayerSource" AS ENUM ('REGISTERED_USER', 'GUEST_PLAYER', 'LOCAL');

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80),
    "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT',
    "dictionaryPolicy" "DictionaryPolicy" NOT NULL,
    "ownerType" "MatchOwnerType" NOT NULL,
    "ownerUserId" TEXT,
    "ownerGuestSessionId" TEXT,
    "currentTurnOrder" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_players" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "source" "MatchPlayerSource" NOT NULL,
    "registeredUserId" TEXT,
    "guestPlayerId" TEXT,
    "displayName" VARCHAR(40) NOT NULL,
    "normalizedName" VARCHAR(40) NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "turnOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_ownerUserId_idx" ON "matches"("ownerUserId");

-- CreateIndex
CREATE INDEX "matches_ownerGuestSessionId_idx" ON "matches"("ownerGuestSessionId");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_createdAt_idx" ON "matches"("createdAt");

-- CreateIndex
CREATE INDEX "match_players_matchId_idx" ON "match_players"("matchId");

-- CreateIndex
CREATE INDEX "match_players_registeredUserId_idx" ON "match_players"("registeredUserId");

-- CreateIndex
CREATE INDEX "match_players_guestPlayerId_idx" ON "match_players"("guestPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_matchId_normalizedName_key" ON "match_players"("matchId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_matchId_seatNumber_key" ON "match_players"("matchId", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "match_players_matchId_turnOrder_key" ON "match_players"("matchId", "turnOrder");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_ownerGuestSessionId_fkey" FOREIGN KEY ("ownerGuestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_registeredUserId_fkey" FOREIGN KEY ("registeredUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_guestPlayerId_fkey" FOREIGN KEY ("guestPlayerId") REFERENCES "guest_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match ownership must correspond with exactly one owner reference.
ALTER TABLE "matches"
ADD CONSTRAINT "matches_owner_reference_check"
CHECK (
  (
    "ownerType" = 'REGISTERED_USER'
    AND "ownerUserId" IS NOT NULL
    AND "ownerGuestSessionId" IS NULL
  )
  OR
  (
    "ownerType" = 'GUEST_SESSION'
    AND "ownerUserId" IS NULL
    AND "ownerGuestSessionId" IS NOT NULL
  )
);

-- Player identity references must correspond with the source.
ALTER TABLE "match_players"
ADD CONSTRAINT "match_players_source_reference_check"
CHECK (
  (
    "source" = 'REGISTERED_USER'
    AND "registeredUserId" IS NOT NULL
    AND "guestPlayerId" IS NULL
  )
  OR
  (
    "source" = 'GUEST_PLAYER'
    AND "registeredUserId" IS NULL
    AND "guestPlayerId" IS NOT NULL
  )
  OR
  (
    "source" = 'LOCAL'
    AND "registeredUserId" IS NULL
    AND "guestPlayerId" IS NULL
  )
);

ALTER TABLE "match_players"
ADD CONSTRAINT "match_players_seat_number_check"
CHECK ("seatNumber" BETWEEN 1 AND 4);

ALTER TABLE "match_players"
ADD CONSTRAINT "match_players_turn_order_check"
CHECK ("turnOrder" BETWEEN 1 AND 4);

ALTER TABLE "matches"
ADD CONSTRAINT "matches_current_turn_order_check"
CHECK (
  "currentTurnOrder" IS NULL
  OR "currentTurnOrder" BETWEEN 1 AND 4
);
