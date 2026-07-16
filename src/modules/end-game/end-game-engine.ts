import {
  getEnglishTileValue
} from "../turns/turn-scoring.js";

import {
  EndGameScoringError
} from "./end-game.types.js";

import type {
  EndGameCalculationInput,
  EndGameCalculationResult,
  EndGamePlayerInput,
  EndGameRackTileInput,
  FinalPlayerStanding
} from "./end-game.types.js";

interface NormalizedRackTile {
  letter: string;
  isBlank: boolean;
  value: number;
}

interface NormalizedEndGamePlayer {
  playerId: string;
  displayName: string;
  turnOrder: number;
  totalPoints: number;

  rackTiles:
    NormalizedRackTile[];

  rackDeduction: number;
}

interface AdjustedPlayer {
  playerId: string;
  displayName: string;
  turnOrder: number;
  baseScore: number;
  rackTileCount: number;
  rackDeduction: number;
  finishingBonus: number;
  finalScore: number;
}

function normalizeRackTile(
  tile: EndGameRackTileInput
): NormalizedRackTile {
  const letter =
    typeof tile.letter ===
    "string"
      ? tile.letter
          .trim()
          .toUpperCase()
      : "";

  if (
    !/^[A-Z]$/.test(letter) ||
    typeof tile.isBlank !==
      "boolean"
  ) {
    throw new EndGameScoringError(
      "END_GAME_TILE_INVALID",
      "Every remaining rack tile must contain one English letter and a valid blank-tile flag."
    );
  }

  return {
    letter,
    isBlank:
      tile.isBlank,

    value:
      tile.isBlank
        ? 0
        : getEnglishTileValue(
            letter
          )
  };
}

function normalizePlayer(
  player: EndGamePlayerInput
): NormalizedEndGamePlayer {
  const playerId =
    typeof player.playerId ===
    "string"
      ? player.playerId.trim()
      : "";

  if (!playerId) {
    throw new EndGameScoringError(
      "END_GAME_PLAYER_ID_INVALID",
      "Every end-game player requires a valid player ID."
    );
  }

  const displayName =
    typeof player.displayName ===
    "string"
      ? player.displayName.trim()
      : "";

  if (!displayName) {
    throw new EndGameScoringError(
      "END_GAME_DISPLAY_NAME_INVALID",
      "Every end-game player requires a display name."
    );
  }

  if (
    !Number.isInteger(
      player.turnOrder
    ) ||
    player.turnOrder < 1
  ) {
    throw new EndGameScoringError(
      "END_GAME_TURN_ORDER_INVALID",
      "Every end-game player requires a positive integer turn order."
    );
  }

  if (
    !Number.isInteger(
      player.totalPoints
    ) ||
    player.totalPoints < 0
  ) {
    throw new EndGameScoringError(
      "END_GAME_TOTAL_INVALID",
      "A player's private cumulative score must be a non-negative integer."
    );
  }

  if (
    !Array.isArray(
      player.rackTiles
    ) ||
    player.rackTiles.length > 7
  ) {
    throw new EndGameScoringError(
      "END_GAME_RACK_TOO_LARGE",
      "A remaining Scrabble rack cannot contain more than seven tiles."
    );
  }

  const rackTiles =
    player.rackTiles.map(
      normalizeRackTile
    );

  return {
    playerId,
    displayName,

    turnOrder:
      player.turnOrder,

    totalPoints:
      player.totalPoints,

    rackTiles,

    rackDeduction:
      rackTiles.reduce(
        (
          total,
          tile
        ) =>
          total +
          tile.value,
        0
      )
  };
}

function assertUniquePlayers(
  players:
    NormalizedEndGamePlayer[]
): void {
  const playerIds =
    new Set<string>();

  const turnOrders =
    new Set<number>();

  for (const player of players) {
    if (
      playerIds.has(
        player.playerId
      )
    ) {
      throw new EndGameScoringError(
        "END_GAME_PLAYER_ID_DUPLICATE",
        "The end-game calculation cannot contain duplicate player IDs."
      );
    }

    if (
      turnOrders.has(
        player.turnOrder
      )
    ) {
      throw new EndGameScoringError(
        "END_GAME_TURN_ORDER_DUPLICATE",
        "The end-game calculation cannot contain duplicate turn orders."
      );
    }

    playerIds.add(
      player.playerId
    );

    turnOrders.add(
      player.turnOrder
    );
  }
}

function resolveFinishingPlayerId(
  input:
    EndGameCalculationInput,
  players:
    NormalizedEndGamePlayer[]
): string | undefined {
  if (
    input.reason ===
    "STALEMATE"
  ) {
    if (
      input.finishingPlayerId !==
      undefined
    ) {
      throw new EndGameScoringError(
        "END_GAME_FINISHER_NOT_ALLOWED",
        "A stalemate cannot include a finishing player."
      );
    }

    return undefined;
  }

  const finishingPlayerId =
    input.finishingPlayerId
      ?.trim();

  if (!finishingPlayerId) {
    throw new EndGameScoringError(
      "END_GAME_FINISHER_REQUIRED",
      "A player who emptied their rack is required."
    );
  }

  const finishingPlayer =
    players.find(
      (player) =>
        player.playerId ===
        finishingPlayerId
    );

  if (!finishingPlayer) {
    throw new EndGameScoringError(
      "END_GAME_FINISHER_NOT_FOUND",
      "The finishing player does not belong to this match."
    );
  }

  if (
    finishingPlayer
      .rackTiles.length !== 0
  ) {
    throw new EndGameScoringError(
      "END_GAME_FINISHER_RACK_NOT_EMPTY",
      "The finishing player must have an empty remaining rack."
    );
  }

  return finishingPlayerId;
}

function rankPlayers(
  players:
    AdjustedPlayer[]
): FinalPlayerStanding[] {
  const ordered =
    [...players].sort(
      (
        first,
        second
      ) =>
        second.finalScore -
          first.finalScore ||
        first.turnOrder -
          second.turnOrder ||
        first.playerId.localeCompare(
          second.playerId
        )
    );

  let currentRank = 0;

  let previousScore:
    number | undefined;

  return ordered.map(
    (player) => {
      if (
        previousScore ===
          undefined ||
        player.finalScore !==
          previousScore
      ) {
        currentRank += 1;

        previousScore =
          player.finalScore;
      }

      return {
        ...player,
        rank:
          currentRank,

        isWinner:
          currentRank === 1
      };
    }
  );
}

export function calculateEndGameResults(
  input:
    EndGameCalculationInput
): EndGameCalculationResult {
  if (
    !Array.isArray(
      input.players
    ) ||
    input.players.length < 2 ||
    input.players.length > 4
  ) {
    throw new EndGameScoringError(
      "END_GAME_PLAYER_COUNT_INVALID",
      "An end-game calculation requires between two and four players."
    );
  }

  const players =
    input.players.map(
      normalizePlayer
    );

  assertUniquePlayers(
    players
  );

  const finishingPlayerId =
    resolveFinishingPlayerId(
      input,
      players
    );

  const totalRackDeduction =
    players.reduce(
      (
        total,
        player
      ) =>
        total +
        player.rackDeduction,
      0
    );

  const adjustedPlayers =
    players.map(
      (
        player
      ): AdjustedPlayer => {
        const finishingBonus =
          player.playerId ===
          finishingPlayerId
            ? totalRackDeduction -
              player.rackDeduction
            : 0;

        return {
          playerId:
            player.playerId,

          displayName:
            player.displayName,

          turnOrder:
            player.turnOrder,

          baseScore:
            player.totalPoints,

          rackTileCount:
            player.rackTiles.length,

          rackDeduction:
            player.rackDeduction,

          finishingBonus,

          finalScore:
            player.totalPoints -
            player.rackDeduction +
            finishingBonus
        };
      }
    );

  const standings =
    rankPlayers(
      adjustedPlayers
    );

  const winners =
    standings
      .filter(
        (player) =>
          player.isWinner
      )
      .map(
        (player) => ({
          playerId:
            player.playerId,

          displayName:
            player.displayName
        })
      );

  const podium =
    standings.filter(
      (player) =>
        player.rank <= 3
    );

  return {
    reason:
      input.reason,

    ...(finishingPlayerId ===
    undefined
      ? {}
      : {
          finishingPlayerId
        }),

    totalRackDeduction,

    hasSharedWin:
      winners.length > 1,

    winners,
    podium,
    standings
  };
}
