import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";

import type {
  MatchActor
} from "../matches/match.types.js";

import {
  getEnglishTileValue
} from "../turns/turn-scoring.js";

import {
  calculateEndGameResults
} from "./end-game-engine.js";

import type {
  CompleteMatchInput
} from "./end-game.schemas.js";

import {
  EndGameScoringError
} from "./end-game.types.js";

import type {
  EndGameCalculationResult,
  PublicFinalStanding,
  PublicMatchResult
} from "./end-game.types.js";

interface CompletionMatchPlayer {
  id: string;
  displayName: string;
  turnOrder: number;
  totalPoints: number;
}

interface CompletionMatch {
  status:
    | "DRAFT"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";

  players:
    CompletionMatchPlayer[];
}


function createOwnerFilter(
  actor: MatchActor
):
  | {
      ownerType:
        "REGISTERED_USER";
      ownerUserId: string;
    }
  | {
      ownerType:
        "GUEST_SESSION";
      ownerGuestSessionId:
        string;
    } {
  if (
    actor.type ===
    "REGISTERED_USER"
  ) {
    return {
      ownerType:
        "REGISTERED_USER",

      ownerUserId:
        actor.userId
    };
  }

  return {
    ownerType:
      "GUEST_SESSION",

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
    typeof error.code ===
      "string"
  ) {
    return error.code;
  }

  return null;
}

function assertCompletionStatus(
  match: CompletionMatch
): void {
  if (
    match.status ===
    "COMPLETED"
  ) {
    throw new AppError(
      "This match has already been completed.",
      409,
      "MATCH_ALREADY_COMPLETED"
    );
  }

  if (
    match.status !==
    "IN_PROGRESS"
  ) {
    throw new AppError(
      "Only an active match can be completed.",
      409,
      "MATCH_NOT_COMPLETABLE"
    );
  }
}

function assertExactPlayerRoster(
  matchPlayers:
    CompletionMatchPlayer[],
  input:
    CompleteMatchInput
): void {
  const submittedIds =
    input.players.map(
      (player) =>
        player.playerId
    );

  const uniqueSubmittedIds =
    new Set(
      submittedIds
    );

  const matchIds =
    new Set(
      matchPlayers.map(
        (player) =>
          player.id
      )
    );

  const hasUnknownPlayer =
    submittedIds.some(
      (playerId) =>
        !matchIds.has(
          playerId
        )
    );

  if (
    input.players.length !==
      matchPlayers.length ||
    uniqueSubmittedIds.size !==
      input.players.length ||
    hasUnknownPlayer
  ) {
    throw new AppError(
      "The completion request must include every match player exactly once.",
      400,
      "END_GAME_PLAYER_ROSTER_INVALID"
    );
  }
}

function calculateResults(
  matchPlayers:
    CompletionMatchPlayer[],
  input:
    CompleteMatchInput
): EndGameCalculationResult {
  const rackByPlayerId =
    new Map(
      input.players.map(
        (player) => [
          player.playerId,
          player.rackTiles
        ]
      )
    );

  try {
    return calculateEndGameResults({
      reason:
        input.reason,

      players:
        matchPlayers.map(
          (player) => ({
            playerId:
              player.id,

            displayName:
              player.displayName,

            turnOrder:
              player.turnOrder,

            totalPoints:
              player.totalPoints,

            rackTiles:
              rackByPlayerId.get(
                player.id
              ) ?? []
          })
        ),

      ...(input.finishingPlayerId ===
      undefined
        ? {}
        : {
            finishingPlayerId:
              input.finishingPlayerId
          })
    });
  } catch (error: unknown) {
    if (
      error instanceof
      EndGameScoringError
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

export async function completeMatch(
  actor: MatchActor,
  matchId: string,
  input:
    CompleteMatchInput
): Promise<PublicMatchResult> {
  const ownerFilter =
    createOwnerFilter(actor);

  try {
    await prisma.$transaction(
        async (
          transaction
        ): Promise<void> => {
          const match =
            await transaction.match.findFirst({
              where: {
                id: matchId,
                ...ownerFilter
              },

              select: {
                status: true,

                players: {
                  select: {
                    id: true,
                    displayName: true,
                    turnOrder: true,
                    totalPoints: true
                  },

                  orderBy: {
                    turnOrder:
                      "asc"
                  }
                }
              }
            });

          if (!match) {
            throw new AppError(
              "The match could not be found.",
              404,
              "MATCH_NOT_FOUND"
            );
          }

          assertCompletionStatus(
            match
          );

          assertExactPlayerRoster(
            match.players,
            input
          );

          const calculation =
            calculateResults(
              match.players,
              input
            );

          const completedAt =
            new Date();

          const completed =
            await transaction.match.updateMany({
              where: {
                id: matchId,
                status:
                  "IN_PROGRESS"
              },

              data: {
                status:
                  "COMPLETED",

                completedAt,
                currentTurnOrder:
                  null,

                cancelledAt:
                  null
              }
            });

          if (
            completed.count !== 1
          ) {
            throw new AppError(
              "The match changed before completion could be saved.",
              409,
              "MATCH_COMPLETION_CONFLICT"
            );
          }

          const rackByPlayerId =
            new Map(
              input.players.map(
                (player) => [
                  player.playerId,
                  player.rackTiles
                ]
              )
            );

          await transaction.matchResult.create({
            data: {
              matchId,

              reason:
                calculation.reason,

              finishingPlayerId:
                calculation
                  .finishingPlayerId ??
                null,

              totalRackDeduction:
                calculation
                  .totalRackDeduction,

              hasSharedWin:
                calculation
                  .hasSharedWin,

              playerResults: {
                create:
                  calculation.standings.map(
                    (standing) => {
                      const rackTiles =
                        rackByPlayerId.get(
                          standing.playerId
                        ) ?? [];

                      return {
                        matchPlayerId:
                          standing.playerId,

                        baseScore:
                          standing.baseScore,

                        rackTileCount:
                          standing.rackTileCount,

                        rackDeduction:
                          standing.rackDeduction,

                        finishingBonus:
                          standing.finishingBonus,

                        finalScore:
                          standing.finalScore,

                        rank:
                          standing.rank,

                        isWinner:
                          standing.isWinner,

                        ...(rackTiles.length ===
                        0
                          ? {}
                          : {
                              remainingRack: {
                                create:
                                  rackTiles.map(
                                    (
                                      tile,
                                      index
                                    ) => ({
                                      tileOrder:
                                        index + 1,

                                      letter:
                                        tile.letter,

                                      isBlank:
                                        tile.isBlank,

                                      value:
                                        tile.isBlank
                                          ? 0
                                          : getEnglishTileValue(
                                              tile.letter
                                            )
                                    })
                                  )
                              }
                            })
                      };
                    }
                  )
              }
            }
          });

          return;
        },
        {
          isolationLevel:
            "Serializable"
        }
      );

    return getMatchResult(
      actor,
      matchId
    );
  } catch (error: unknown) {
    const errorCode =
      getErrorCode(error);

    if (
      errorCode === "P2002" ||
      errorCode === "P2034"
    ) {
      throw new AppError(
        "The match could not be completed because its state changed.",
        409,
        "MATCH_COMPLETION_CONFLICT"
      );
    }

    throw error;
  }
}

export async function getMatchResult(
  actor: MatchActor,
  matchId: string
): Promise<PublicMatchResult> {
  const match =
    await prisma.match.findFirst({
      where: {
        id: matchId,
        ...createOwnerFilter(actor)
      },

      select: {
        status: true,
        completedAt: true,

        turns: {
          select: {
            turnNumber: true,
            points: true,
            bingoBonus: true,

            matchPlayer: {
              select: {
                id: true,
                displayName: true
              }
            },

            words: {
              select: {
                wordOrder: true,
                word: true,
                points: true
              },

              orderBy: {
                wordOrder: "asc"
              }
            }
          },

          orderBy: {
            turnNumber: "asc"
          }
        },

        experienceSnapshots: {
          select: {
            events: {
              select: {
                type: true
              }
            }
          },

          orderBy: {
            turnNumber: "asc"
          }
        },

        finalResult: {
          include: {
            playerResults: {
              include: {
                matchPlayer: {
                  select: {
                    id: true,
                    displayName: true,
                    turnOrder: true
                  }
                },

                remainingRack: {
                  orderBy: {
                    tileOrder: "asc"
                  }
                }
              }
            }
          }
        }
      }
    });

  if (!match) {
    throw new AppError(
      "The match could not be found.",
      404,
      "MATCH_NOT_FOUND"
    );
  }

  if (
    match.status !==
    "COMPLETED"
  ) {
    throw new AppError(
      "Exact final results are only available after the match has been completed.",
      409,
      "MATCH_RESULT_NOT_AVAILABLE"
    );
  }

  if (
    !match.completedAt ||
    !match.finalResult
  ) {
    throw new AppError(
      "The completed match result could not be loaded.",
      500,
      "MATCH_RESULT_STORAGE_MISSING"
    );
  }

  const orderedResults =
    [
      ...match.finalResult
        .playerResults
    ].sort(
      (
        first,
        second
      ) =>
        first.rank -
          second.rank ||
        first.matchPlayer
          .turnOrder -
          second.matchPlayer
            .turnOrder ||
        first.matchPlayer.id
          .localeCompare(
            second.matchPlayer.id
          )
    );

  const standings:
    PublicFinalStanding[] =
      orderedResults.map(
        (entry) => ({
          playerId:
            entry.matchPlayer.id,

          displayName:
            entry.matchPlayer
              .displayName,

          turnOrder:
            entry.matchPlayer
              .turnOrder,

          baseScore:
            entry.baseScore,

          rackTileCount:
            entry.rackTileCount,

          rackDeduction:
            entry.rackDeduction,

          finishingBonus:
            entry.finishingBonus,

          finalScore:
            entry.finalScore,

          rank:
            entry.rank,

          isWinner:
            entry.isWinner,

          remainingRack:
            entry.remainingRack.map(
              (tile) => ({
                letter:
                  tile.letter,

                isBlank:
                  tile.isBlank,

                value:
                  tile.value
              })
            )
        })
      );

  const winners =
    standings
      .filter(
        (standing) =>
          standing.isWinner
      )
      .map(
        (standing) => ({
          playerId:
            standing.playerId,

          displayName:
            standing.displayName
        })
      );

  const highestScoringTurnRecord =
    [...match.turns].sort(
      (
        first,
        second
      ) =>
        second.points -
          first.points ||
        first.turnNumber -
          second.turnNumber
    )[0] ?? null;

  const wordCandidates =
    match.turns.flatMap(
      (turn) =>
        turn.words.map(
          (word) => ({
            word:
              word.word,

            points:
              word.points,

            wordOrder:
              word.wordOrder,

            turnNumber:
              turn.turnNumber,

            playerId:
              turn.matchPlayer.id,

            displayName:
              turn.matchPlayer
                .displayName
          })
        )
    );

  const highestScoringWordRecord =
    [...wordCandidates].sort(
      (
        first,
        second
      ) =>
        second.points -
          first.points ||
        first.turnNumber -
          second.turnNumber ||
        first.wordOrder -
          second.wordOrder ||
        first.word.localeCompare(
          second.word
        )
    )[0] ?? null;

  const experienceEventCounts = {
    leadChanges: 0,
    sharedLeads: 0,
    rankRises: 0,
    comebacks: 0,
    momentumShifts: 0
  };

  for (
    const snapshot of
    match.experienceSnapshots
  ) {
    for (
      const event of
      snapshot.events
    ) {
      switch (event.type) {
        case "LEAD_CHANGE":
          experienceEventCounts
            .leadChanges += 1;
          break;

        case "SHARED_LEAD":
          experienceEventCounts
            .sharedLeads += 1;
          break;

        case "RANK_RISE":
          experienceEventCounts
            .rankRises += 1;
          break;

        case "COMEBACK":
          experienceEventCounts
            .comebacks += 1;
          break;

        case "MOMENTUM_SHIFT":
          experienceEventCounts
            .momentumShifts += 1;
          break;
      }
    }
  }

  const totalExperienceEvents =
    experienceEventCounts
      .leadChanges +
    experienceEventCounts
      .sharedLeads +
    experienceEventCounts
      .rankRises +
    experienceEventCounts
      .comebacks +
    experienceEventCounts
      .momentumShifts;

  return {
    matchId,
    status:
      "COMPLETED",

    reason:
      match.finalResult.reason,

    finishingPlayerId:
      match.finalResult
        .finishingPlayerId,

    completedAt:
      match.completedAt
        .toISOString(),

    totalRackDeduction:
      match.finalResult
        .totalRackDeduction,

    hasSharedWin:
      match.finalResult
        .hasSharedWin,

    highlights: {
      totalTurns:
        match.turns.length,

      totalWords:
        wordCandidates.length,

      bingoCount:
        match.turns.filter(
          (turn) =>
            turn.bingoBonus > 0
        ).length,

      highestScoringTurn:
        highestScoringTurnRecord ===
        null
          ? null
          : {
              turnNumber:
                highestScoringTurnRecord
                  .turnNumber,

              points:
                highestScoringTurnRecord
                  .points,

              playerId:
                highestScoringTurnRecord
                  .matchPlayer.id,

              displayName:
                highestScoringTurnRecord
                  .matchPlayer
                  .displayName
            },

      highestScoringWord:
        highestScoringWordRecord ===
        null
          ? null
          : {
              word:
                highestScoringWordRecord
                  .word,

              points:
                highestScoringWordRecord
                  .points,

              turnNumber:
                highestScoringWordRecord
                  .turnNumber,

              playerId:
                highestScoringWordRecord
                  .playerId,

              displayName:
                highestScoringWordRecord
                  .displayName
            },

      experienceEvents: {
        total:
          totalExperienceEvents,

        ...experienceEventCounts
      }
    },

    winners,

    podium:
      standings.filter(
        (standing) =>
          standing.rank <= 3
      ),

    standings
  };
}
