-- CreateEnum
CREATE TYPE "TurnTilePremium" AS ENUM ('NONE', 'DOUBLE_LETTER', 'TRIPLE_LETTER', 'DOUBLE_WORD', 'TRIPLE_WORD');

-- AlterTable
ALTER TABLE "match_players" ADD COLUMN     "totalPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "nextTurnNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "turns" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchPlayerId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(120) NOT NULL,
    "wordPoints" INTEGER NOT NULL,
    "bingoBonus" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL,
    "placedTileCount" INTEGER NOT NULL,
    "replacementTileCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_words" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "wordOrder" INTEGER NOT NULL,
    "word" VARCHAR(40) NOT NULL,
    "letterPoints" INTEGER NOT NULL,
    "wordMultiplier" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_placed_tiles" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "tileOrder" INTEGER NOT NULL,
    "clientTileId" VARCHAR(60) NOT NULL,
    "letter" VARCHAR(1) NOT NULL,
    "isBlank" BOOLEAN NOT NULL,
    "premium" "TurnTilePremium" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_placed_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turns_matchPlayerId_idx" ON "turns"("matchPlayerId");

-- CreateIndex
CREATE INDEX "turns_createdAt_idx" ON "turns"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "turns_matchId_turnNumber_key" ON "turns"("matchId", "turnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "turns_matchId_idempotencyKey_key" ON "turns"("matchId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "turn_words_turnId_idx" ON "turn_words"("turnId");

-- CreateIndex
CREATE UNIQUE INDEX "turn_words_turnId_wordOrder_key" ON "turn_words"("turnId", "wordOrder");

-- CreateIndex
CREATE INDEX "turn_placed_tiles_turnId_idx" ON "turn_placed_tiles"("turnId");

-- CreateIndex
CREATE UNIQUE INDEX "turn_placed_tiles_turnId_tileOrder_key" ON "turn_placed_tiles"("turnId", "tileOrder");

-- CreateIndex
CREATE UNIQUE INDEX "turn_placed_tiles_turnId_clientTileId_key" ON "turn_placed_tiles"("turnId", "clientTileId");

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turns" ADD CONSTRAINT "turns_matchPlayerId_fkey" FOREIGN KEY ("matchPlayerId") REFERENCES "match_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_words" ADD CONSTRAINT "turn_words_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_placed_tiles" ADD CONSTRAINT "turn_placed_tiles_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sprint 4 turn-storage integrity constraints.
ALTER TABLE "matches"
ADD CONSTRAINT "matches_next_turn_number_positive"
CHECK ("nextTurnNumber" >= 1);

ALTER TABLE "match_players"
ADD CONSTRAINT "match_players_total_points_nonnegative"
CHECK ("totalPoints" >= 0);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_turn_number_positive"
CHECK ("turnNumber" >= 1);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_idempotency_key_not_blank"
CHECK (length(btrim("idempotencyKey")) > 0);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_word_points_nonnegative"
CHECK ("wordPoints" >= 0);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_bingo_bonus_valid"
CHECK ("bingoBonus" IN (0, 50));

ALTER TABLE "turns"
ADD CONSTRAINT "turns_points_consistent"
CHECK (
  "points" >= 0
  AND "points" = "wordPoints" + "bingoBonus"
);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_placed_tile_count_valid"
CHECK ("placedTileCount" BETWEEN 1 AND 7);

ALTER TABLE "turns"
ADD CONSTRAINT "turns_replacement_tile_count_valid"
CHECK ("replacementTileCount" BETWEEN 0 AND 7);

ALTER TABLE "turn_words"
ADD CONSTRAINT "turn_words_order_positive"
CHECK ("wordOrder" >= 1);

ALTER TABLE "turn_words"
ADD CONSTRAINT "turn_words_word_valid"
CHECK ("word" ~ '^[A-Z]+$');

ALTER TABLE "turn_words"
ADD CONSTRAINT "turn_words_letter_points_nonnegative"
CHECK ("letterPoints" >= 0);

ALTER TABLE "turn_words"
ADD CONSTRAINT "turn_words_multiplier_positive"
CHECK ("wordMultiplier" >= 1);

ALTER TABLE "turn_words"
ADD CONSTRAINT "turn_words_points_consistent"
CHECK (
  "points" >= 0
  AND "points" = "letterPoints" * "wordMultiplier"
);

ALTER TABLE "turn_placed_tiles"
ADD CONSTRAINT "turn_placed_tiles_order_positive"
CHECK ("tileOrder" >= 1);

ALTER TABLE "turn_placed_tiles"
ADD CONSTRAINT "turn_placed_tiles_client_id_not_blank"
CHECK (length(btrim("clientTileId")) > 0);

ALTER TABLE "turn_placed_tiles"
ADD CONSTRAINT "turn_placed_tiles_letter_valid"
CHECK ("letter" ~ '^[A-Z]$');

