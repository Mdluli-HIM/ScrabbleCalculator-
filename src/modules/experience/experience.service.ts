import type {
  Prisma
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";

import type {
  MatchActor
} from "../matches/match.types.js";

import {
  buildMatchExperience
} from "./experience-engine.js";

import type {
  ExperienceCloseness,
  ExperienceEventType,
  ExperienceMomentum,
  ExperiencePhase,
  ExperiencePlayerInput,
  ExperienceRankMovement,
  PreviousExperienceState,
  PublicMatchExperience
} from "./experience.types.js";

type ExperienceDatabaseClient =
  Pick<
    Prisma.TransactionClient,
    | "matchPlayer"
    | "turn"
    | "matchExperienceSnapshot"
  >;

interface ExperiencePlayerSnapshot {
  id: string;
  displayName: string;
  turnOrder: number;
}

interface ExperienceTurnSnapshot {
  matchPlayerId: string;
  turnNumber: number;
  points: number;
}

interface PersistedStandingRecord {
  rank: number;
  movement:
    ExperienceRankMovement;
  momentum:
    ExperienceMomentum;
  isLeader: boolean;

  matchPlayer: {
    id: string;
    displayName: string;
    turnOrder: number;
  };
}

interface PersistedEventRecord {
  type:
    ExperienceEventType;
  matchPlayerId: string;
  relatedMatchPlayerId:
    string | null;
  createdAt: Date;
  id: string;
}

interface PersistedSnapshotRecord {
  phase:
    ExperiencePhase;
  closeness:
    ExperienceCloseness;
  hasSharedLead: boolean;

  standings:
    PersistedStandingRecord[];

  events:
    PersistedEventRecord[];
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

function buildExperiencePlayers(
  players:
    ExperiencePlayerSnapshot[],
  turns:
    ExperienceTurnSnapshot[]
): ExperiencePlayerInput[] {
  return players.map(
    (player) => {
      const playerTurns =
        turns.filter(
          (turn) =>
            turn.matchPlayerId ===
            player.id
        );

      return {
        playerId:
          player.id,

        displayName:
          player.displayName,

        turnOrder:
          player.turnOrder,

        /**
         * These values remain private
         * engine inputs.
         */
        totalPoints:
          playerTurns.reduce(
            (
              total,
              turn
            ) =>
              total +
              turn.points,
            0
          ),

        recentTurnPoints:
          playerTurns
            .map(
              (turn) =>
                turn.points
            )
            .slice(-3)
      };
    }
  );
}

function createPreviousState(
  experience:
    PublicMatchExperience
): PreviousExperienceState {
  return {
    ranks:
      Object.fromEntries(
        experience.standings.map(
          (standing) => [
            standing.playerId,
            standing.rank
          ]
        )
      ),

    leaderIds:
      experience.leaders.map(
        (leader) =>
          leader.playerId
      ),

    momentumByPlayerId:
      Object.fromEntries(
        experience.standings.map(
          (standing) => [
            standing.playerId,
            standing.momentum
          ]
        )
      )
  };
}

function serializePersistedSnapshot(
  snapshot:
    PersistedSnapshotRecord
): PublicMatchExperience {
  const standings =
    [...snapshot.standings]
      .sort(
        (
          first,
          second
        ) =>
          first.rank -
            second.rank ||
          first.matchPlayer
            .turnOrder -
            second.matchPlayer
              .turnOrder
      )
      .map(
        (standing) => ({
          playerId:
            standing
              .matchPlayer.id,

          displayName:
            standing
              .matchPlayer
              .displayName,

          rank:
            standing.rank,

          movement:
            standing.movement,

          momentum:
            standing.momentum,

          isLeader:
            standing.isLeader
        })
      );

  const leaders =
    standings
      .filter(
        (standing) =>
          standing.isLeader
      )
      .map(
        (standing) => ({
          playerId:
            standing.playerId,

          displayName:
            standing.displayName
        })
      );

  const events =
    [...snapshot.events]
      .sort(
        (
          first,
          second
        ) =>
          first.createdAt
            .getTime() -
            second.createdAt
              .getTime() ||
          first.id.localeCompare(
            second.id
          )
      )
      .map(
        (event) => ({
          type:
            event.type,

          playerId:
            event.matchPlayerId,

          ...(event
            .relatedMatchPlayerId
            ? {
                relatedPlayerId:
                  event
                    .relatedMatchPlayerId
              }
            : {})
        })
      );

  return {
    phase:
      snapshot.phase,

    leaders,

    hasSharedLead:
      snapshot.hasSharedLead,

    closeness:
      snapshot.closeness,

    standings,

    events
  };
}

export async function buildStoredMatchExperience(
  matchId: string,
  throughTurnNumber?: number,
  database:
    ExperienceDatabaseClient =
      prisma
): Promise<PublicMatchExperience> {
  const players =
    await database
      .matchPlayer
      .findMany({
        where: {
          matchId
        },

        select: {
          id: true,
          displayName: true,
          turnOrder: true
        },

        orderBy: {
          turnOrder:
            "asc"
        }
      });

  /**
   * Transaction-client queries must run
   * sequentially because they share one
   * PostgreSQL connection.
   */
  const turns =
    await database.turn.findMany({
      where: {
        matchId,

        ...(throughTurnNumber ===
        undefined
          ? {}
          : {
              turnNumber: {
                lte:
                  throughTurnNumber
              }
            })
      },

      select: {
        matchPlayerId: true,
        turnNumber: true,
        points: true
      },

      orderBy: {
        turnNumber:
          "asc"
      }
    });

  if (
    turns.length === 0
  ) {
    return buildMatchExperience({
      players:
        buildExperiencePlayers(
          players,
          turns
        ),

      completedTurns: 0
    });
  }

  const latestTurn =
    turns[
      turns.length - 1
    ];

  const previousTurns =
    latestTurn === undefined
      ? []
      : turns.filter(
          (turn) =>
            turn.turnNumber <
            latestTurn.turnNumber
        );

  const previousExperience =
    buildMatchExperience({
      players:
        buildExperiencePlayers(
          players,
          previousTurns
        ),

      completedTurns:
        previousTurns.length
    });

  return buildMatchExperience({
    players:
      buildExperiencePlayers(
        players,
        turns
      ),

    completedTurns:
      turns.length,

    previous:
      createPreviousState(
        previousExperience
      )
  });
}

export async function readPersistedMatchExperience(
  matchId: string,
  turnNumber?: number,
  database:
    ExperienceDatabaseClient =
      prisma
): Promise<
  PublicMatchExperience | null
> {
  const snapshot =
    await database
      .matchExperienceSnapshot
      .findFirst({
        where: {
          matchId,

          ...(turnNumber ===
          undefined
            ? {}
            : {
                turnNumber
              })
        },

        include: {
          standings: {
            include: {
              matchPlayer: {
                select: {
                  id: true,
                  displayName: true,
                  turnOrder: true
                }
              }
            }
          },

          events: true
        },

        orderBy: {
          turnNumber:
            "desc"
        }
      });

  if (!snapshot) {
    return null;
  }

  return serializePersistedSnapshot(
    snapshot
  );
}

export async function persistMatchExperienceSnapshot(
  database:
    ExperienceDatabaseClient,
  input: {
    matchId: string;
    turnId: string;
    turnNumber: number;
    experience:
      PublicMatchExperience;
  }
): Promise<void> {
  await database
    .matchExperienceSnapshot
    .create({
      data: {
        matchId:
          input.matchId,

        turnId:
          input.turnId,

        turnNumber:
          input.turnNumber,

        phase:
          input.experience.phase,

        closeness:
          input.experience
            .closeness,

        hasSharedLead:
          input.experience
            .hasSharedLead,

        standings: {
          create:
            input.experience
              .standings
              .map(
                (standing) => ({
                  matchPlayerId:
                    standing.playerId,

                  rank:
                    standing.rank,

                  movement:
                    standing.movement,

                  momentum:
                    standing.momentum,

                  isLeader:
                    standing.isLeader
                })
              )
        },

        events: {
          create:
            input.experience
              .events
              .map(
                (event) => ({
                  type:
                    event.type,

                  matchPlayerId:
                    event.playerId,

                  ...(event
                    .relatedPlayerId
                    ? {
                        relatedMatchPlayerId:
                          event
                            .relatedPlayerId
                      }
                    : {})
                })
              )
        }
      }
    });
}

export async function getMatchExperience(
  actor: MatchActor,
  matchId: string
): Promise<PublicMatchExperience> {
  const match =
    await prisma.match.findFirst({
      where: {
        id: matchId,

        ...createOwnerFilter(
          actor
        )
      },

      select: {
        id: true
      }
    });

  if (!match) {
    throw new AppError(
      "The requested match could not be found.",
      404,
      "MATCH_NOT_FOUND"
    );
  }

  const persisted =
    await readPersistedMatchExperience(
      match.id
    );

  if (persisted) {
    return persisted;
  }

  return buildStoredMatchExperience(
    match.id
  );
}
