import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";

import {
  validateDictionaryWords
} from "../dictionary/dictionary.service.js";

import type {
  MatchActor
} from "../matches/match.types.js";

import {
  calculateTurnScore
} from "./turn-scoring.js";

import {
  TurnScoringError
} from "./turn-scoring.types.js";

import type {
  TurnScoreResult
} from "./turn-scoring.types.js";

import type {
  SubmitTurnInput
} from "./turn.schemas.js";

import type {
  PublicTurn,
  PublicTurnPlayer,
  SubmitTurnResult
} from "./turn.types.js";

interface MatchPlayerSnapshot {
  id: string;
  displayName: string;
  turnOrder: number;
}

interface TurnMatchSnapshot {
  status:
    | "DRAFT"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  currentTurnOrder: number | null;
  nextTurnNumber: number;
  players: MatchPlayerSnapshot[];
}

interface StoredTurnRecord {
  id: string;
  matchId: string;
  turnNumber: number;
  wordPoints: number;
  bingoBonus: number;
  points: number;
  placedTileCount: number;
  replacementTileCount: number;
  createdAt: Date;
  matchPlayer: MatchPlayerSnapshot;
  words: {
    wordOrder: number;
    word: string;
    letterPoints: number;
    wordMultiplier: number;
    points: number;
  }[];
  placedTiles: {
    tileOrder: number;
    clientTileId: string;
    letter: string;
    isBlank: boolean;
    premium:
      | "NONE"
      | "DOUBLE_LETTER"
      | "TRIPLE_LETTER"
      | "DOUBLE_WORD"
      | "TRIPLE_WORD";
  }[];
}

interface TurnState {
  currentPlayer: MatchPlayerSnapshot;
  nextPlayer: MatchPlayerSnapshot;
}

interface TransactionResult {
  record: StoredTurnRecord;
  nextPlayer: MatchPlayerSnapshot;
  replayed: boolean;
}

function createOwnerFilter(
  actor: MatchActor
):
  | {
      ownerType: "REGISTERED_USER";
      ownerUserId: string;
    }
  | {
      ownerType: "GUEST_SESSION";
      ownerGuestSessionId: string;
    } {
  if (
    actor.type ===
    "REGISTERED_USER"
  ) {
    return {
      ownerType: "REGISTERED_USER",
      ownerUserId: actor.userId
    };
  }

  return {
    ownerType: "GUEST_SESSION",
    ownerGuestSessionId:
      actor.guestSessionId
  };
}

function getErrorCode(
  error: unknown
): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function publicPlayer(
  player: MatchPlayerSnapshot
): PublicTurnPlayer {
  return {
    id: player.id,
    displayName:
      player.displayName,
    turnOrder:
      player.turnOrder
  };
}

function findNextPlayer(
  players: MatchPlayerSnapshot[],
  currentTurnOrder: number
): MatchPlayerSnapshot {
  const orderedPlayers = [
    ...players
  ].sort(
    (
      first,
      second
    ) =>
      first.turnOrder -
      second.turnOrder
  );

  const currentIndex =
    orderedPlayers.findIndex(
      (player) =>
        player.turnOrder ===
        currentTurnOrder
    );

  if (
    currentIndex < 0 ||
    orderedPlayers.length < 2
  ) {
    throw new AppError(
      "The match turn order is invalid.",
      409,
      "MATCH_TURN_ORDER_INVALID"
    );
  }

  return orderedPlayers[
    (
      currentIndex + 1
    ) %
    orderedPlayers.length
  ] as MatchPlayerSnapshot;
}

function assertTurnState(
  match: TurnMatchSnapshot,
  submittedPlayerId: string
): TurnState {
  if (
    match.status !==
    "IN_PROGRESS"
  ) {
    throw new AppError(
      "Turns can only be submitted while a match is in progress.",
      409,
      "MATCH_NOT_IN_PROGRESS"
    );
  }

  if (
    match.currentTurnOrder ===
    null
  ) {
    throw new AppError(
      "The match does not have a current player.",
      409,
      "MATCH_TURN_ORDER_INVALID"
    );
  }

  const currentPlayer =
    match.players.find(
      (player) =>
        player.turnOrder ===
        match.currentTurnOrder
    );

  if (!currentPlayer) {
    throw new AppError(
      "The current match player could not be resolved.",
      409,
      "MATCH_TURN_ORDER_INVALID"
    );
  }

  if (
    currentPlayer.id !==
    submittedPlayerId
  ) {
    throw new AppError(
      "The selected player cannot submit this turn.",
      409,
      "PLAYER_NOT_CURRENT_TURN"
    );
  }

  return {
    currentPlayer,
    nextPlayer:
      findNextPlayer(
        match.players,
        currentPlayer.turnOrder
      )
  };
}

function calculateScore(
  input: SubmitTurnInput
): TurnScoreResult {
  try {
    return calculateTurnScore({
      placedTiles:
        input.placedTiles,
      words:
        input.words
    });
  } catch (error: unknown) {
    if (
      error instanceof
      TurnScoringError
    ) {
      throw new AppError(
        error.message,
        400,
        error.code
      );
    }

    throw error;
  }
}

function assertIdempotentRequest(
  record: StoredTurnRecord,
  input: SubmitTurnInput,
  score: TurnScoreResult
): void {
  const samePlayer =
    record.matchPlayer.id ===
    input.playerId;

  const submittedTiles =
    input.placedTiles.map(
      (
        tile,
        index
      ) => ({
        tileOrder: index + 1,
        clientTileId:
          tile.id,
        letter:
          tile.letter,
        isBlank:
          tile.isBlank,
        premium:
          tile.premium
      })
    );

  const storedTiles = [
    ...record.placedTiles
  ]
    .sort(
      (
        first,
        second
      ) =>
        first.tileOrder -
        second.tileOrder
    )
    .map(
      (tile) => ({
        tileOrder:
          tile.tileOrder,
        clientTileId:
          tile.clientTileId,
        letter:
          tile.letter,
        isBlank:
          tile.isBlank,
        premium:
          tile.premium
      })
    );

  const sameTiles =
    JSON.stringify(
      storedTiles
    ) ===
    JSON.stringify(
      submittedTiles
    );

  const sameWords =
    record.words.length ===
      score.words.length &&
    record.words.every(
      (
        word,
        index
      ) => {
        const submittedWord =
          score.words[
            index
          ];

        return (
          submittedWord !==
            undefined &&
          word.word ===
            submittedWord.word &&
          word.letterPoints ===
            submittedWord.letterPoints &&
          word.wordMultiplier ===
            submittedWord.wordMultiplier &&
          word.points ===
            submittedWord.points
        );
      }
    );

  const sameTotals =
    record.wordPoints ===
      score.wordPoints &&
    record.bingoBonus ===
      score.bingoBonus &&
    record.points ===
      score.totalPoints &&
    record.placedTileCount ===
      score.placedTileCount &&
    record.replacementTileCount ===
      score.replacementTileCount;

  if (
    !samePlayer ||
    !sameTiles ||
    !sameWords ||
    !sameTotals
  ) {
    throw new AppError(
      "This idempotency key was already used for a different turn submission.",
      409,
      "IDEMPOTENCY_KEY_REUSED"
    );
  }
}

function serializeTurn(
  record: StoredTurnRecord
): PublicTurn {
  return {
    id: record.id,
    matchId: record.matchId,
    turnNumber:
      record.turnNumber,
    player:
      publicPlayer(
        record.matchPlayer
      ),
    wordPoints:
      record.wordPoints,
    bingoBonus:
      record.bingoBonus,
    points:
      record.points,
    placedTileCount:
      record.placedTileCount,
    replacementTileCount:
      record.replacementTileCount,
    words: [
      ...record.words
    ]
      .sort(
        (
          first,
          second
        ) =>
          first.wordOrder -
          second.wordOrder
      )
      .map(
        (word) => ({
          wordOrder:
            word.wordOrder,
          word: word.word,
          letterPoints:
            word.letterPoints,
          wordMultiplier:
            word.wordMultiplier,
          points:
            word.points
        })
      ),
    createdAt:
      record.createdAt.toISOString()
  };
}

const storedTurnInclude = {
  matchPlayer: {
    select: {
      id: true,
      displayName: true,
      turnOrder: true
    }
  },
  words: {
    orderBy: {
      wordOrder: "asc" as const
    }
  },
  placedTiles: {
    orderBy: {
      tileOrder: "asc" as const
    }
  }
};

async function findStoredTurn(
  matchId: string,
  idempotencyKey: string
): Promise<StoredTurnRecord | null> {
  return prisma.turn.findUnique({
    where: {
      matchId_idempotencyKey: {
        matchId,
        idempotencyKey
      }
    },
    include:
      storedTurnInclude
  });
}

function createReplayResult(
  record: StoredTurnRecord,
  players: MatchPlayerSnapshot[]
): SubmitTurnResult {
  const nextPlayer =
    findNextPlayer(
      players,
      record.matchPlayer.turnOrder
    );

  return {
    turn:
      serializeTurn(record),
    nextPlayer:
      publicPlayer(nextPlayer),
    replayed: true
  };
}

export async function submitTurn(
  actor: MatchActor,
  matchId: string,
  idempotencyKey: string,
  input: SubmitTurnInput
): Promise<SubmitTurnResult> {
  const ownerFilter =
    createOwnerFilter(actor);

  const match =
    await prisma.match.findFirst({
      where: {
        id: matchId,
        ...ownerFilter
      },
      select: {
        status: true,
        currentTurnOrder: true,
        nextTurnNumber: true,
        players: {
          select: {
            id: true,
            displayName: true,
            turnOrder: true
          },
          orderBy: {
            turnOrder: "asc"
          }
        }
      }
    });

  if (!match) {
    throw new AppError(
      "The requested match could not be found.",
      404,
      "MATCH_NOT_FOUND"
    );
  }

  const existingTurn =
    await findStoredTurn(
      matchId,
      idempotencyKey
    );

  if (existingTurn) {
    const score =
      calculateScore(input);

    assertIdempotentRequest(
      existingTurn,
      input,
      score
    );

    return createReplayResult(
      existingTurn,
      match.players
    );
  }

  assertTurnState(
    match,
    input.playerId
  );

  const score =
    calculateScore(input);

  const dictionaryValidation =
    await validateDictionaryWords(
      actor,
      matchId,
      {
        words:
          score.words.map(
            (word) =>
              word.word
          )
      }
    );

  if (
    !dictionaryValidation.accepted
  ) {
    throw new AppError(
      "One or more formed words are invalid.",
      422,
      "TURN_WORDS_INVALID",
      {
        words:
          dictionaryValidation.words
      }
    );
  }

  try {
    const result =
      await prisma.$transaction(
        async (
          transaction
        ): Promise<TransactionResult> => {
          const replayedTurn =
            await transaction.turn.findUnique({
              where: {
                matchId_idempotencyKey: {
                  matchId,
                  idempotencyKey
                }
              },
              include:
                storedTurnInclude
            });

          const currentMatch =
            await transaction.match.findFirst({
              where: {
                id: matchId,
                ...ownerFilter
              },
              select: {
                status: true,
                currentTurnOrder: true,
                nextTurnNumber: true,
                players: {
                  select: {
                    id: true,
                    displayName: true,
                    turnOrder: true
                  },
                  orderBy: {
                    turnOrder:
                      "asc"
                  }
                }
              }
            });

          if (!currentMatch) {
            throw new AppError(
              "The requested match could not be found.",
              404,
              "MATCH_NOT_FOUND"
            );
          }

          if (replayedTurn) {
            assertIdempotentRequest(
              replayedTurn,
              input,
              score
            );

            return {
              record:
                replayedTurn,
              nextPlayer:
                findNextPlayer(
                  currentMatch.players,
                  replayedTurn
                    .matchPlayer
                    .turnOrder
                ),
              replayed: true
            };
          }

          const turnState =
            assertTurnState(
              currentMatch,
              input.playerId
            );

          const advanced =
            await transaction.match.updateMany({
              where: {
                id: matchId,
                status:
                  "IN_PROGRESS",
                currentTurnOrder:
                  turnState
                    .currentPlayer
                    .turnOrder,
                nextTurnNumber:
                  currentMatch
                    .nextTurnNumber
              },
              data: {
                currentTurnOrder:
                  turnState
                    .nextPlayer
                    .turnOrder,
                nextTurnNumber: {
                  increment: 1
                }
              }
            });

          if (
            advanced.count !== 1
          ) {
            throw new AppError(
              "The match changed before the turn could be saved.",
              409,
              "TURN_SUBMISSION_CONFLICT"
            );
          }

          const record =
            await transaction.turn.create({
              data: {
                matchId,
                matchPlayerId:
                  turnState
                    .currentPlayer.id,
                turnNumber:
                  currentMatch
                    .nextTurnNumber,
                idempotencyKey,
                wordPoints:
                  score.wordPoints,
                bingoBonus:
                  score.bingoBonus,
                points:
                  score.totalPoints,
                placedTileCount:
                  score.placedTileCount,
                replacementTileCount:
                  score.replacementTileCount,
                words: {
                  create:
                    score.words.map(
                      (
                        word,
                        index
                      ) => ({
                        wordOrder:
                          index + 1,
                        word:
                          word.word,
                        letterPoints:
                          word.letterPoints,
                        wordMultiplier:
                          word.wordMultiplier,
                        points:
                          word.points
                      })
                    )
                },
                placedTiles: {
                  create:
                    input.placedTiles.map(
                      (
                        tile,
                        index
                      ) => ({
                        tileOrder:
                          index + 1,
                        clientTileId:
                          tile.id,
                        letter:
                          tile.letter,
                        isBlank:
                          tile.isBlank,
                        premium:
                          tile.premium
                      })
                    )
                }
              },
              include:
                storedTurnInclude
            });

          await transaction.matchPlayer.update({
            where: {
              id:
                turnState
                  .currentPlayer.id
            },
            data: {
              totalPoints: {
                increment:
                  score.totalPoints
              }
            }
          });

          return {
            record,
            nextPlayer:
              turnState.nextPlayer,
            replayed: false
          };
        },
        {
          isolationLevel:
            "Serializable"
        }
      );

    return {
      turn:
        serializeTurn(
          result.record
        ),
      nextPlayer:
        publicPlayer(
          result.nextPlayer
        ),
      replayed:
        result.replayed
    };
  } catch (error: unknown) {
    const errorCode =
      getErrorCode(error);

    if (
      errorCode === "P2002" ||
      errorCode === "P2034"
    ) {
      const replayedTurn =
        await findStoredTurn(
          matchId,
          idempotencyKey
        );

      if (replayedTurn) {
        assertIdempotentRequest(
          replayedTurn,
          input,
          score
        );

        return createReplayResult(
          replayedTurn,
          match.players
        );
      }

      throw new AppError(
        "The turn could not be saved because the match changed.",
        409,
        "TURN_SUBMISSION_CONFLICT"
      );
    }

    throw error;
  }
}
