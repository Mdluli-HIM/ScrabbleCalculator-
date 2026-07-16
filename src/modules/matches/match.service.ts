import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import {
  normalizePlayerName
} from "../../utils/normalization.js";

import type {
  AddMatchPlayerInput,
  CreateMatchInput,
  ReorderMatchPlayersInput,
  UpdateDraftMatchInput
} from "./match.schemas.js";

import type {
  MatchActor,
  PublicMatch,
  PublicMatchPlayer
} from "./match.types.js";

interface MatchPlayerRecord {
  id: string;
  source:
    | "REGISTERED_USER"
    | "GUEST_PLAYER"
    | "LOCAL";
  registeredUserId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  normalizedName: string;
  seatNumber: number;
  turnOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MatchRecord {
  id: string;
  name: string | null;
  status:
    | "DRAFT"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  dictionaryPolicy:
    | "LOCAL_WORD_LIST"
    | "OXFORD_ONLY"
    | "TOURNAMENT_LEXICON_ONLY"
    | "BOTH_REQUIRED"
    | "EITHER_ACCEPTED";
  ownerType:
    | "REGISTERED_USER"
    | "GUEST_SESSION";
  ownerUserId: string | null;
  ownerGuestSessionId: string | null;
  dictionaryLexiconId: string | null;
  dictionaryLexicon: {
    code: string;
    version: string;
    name: string;
  } | null;
  currentTurnOrder: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  players: MatchPlayerRecord[];
}

interface ResolvedPlayerIdentity {
  source:
    | "REGISTERED_USER"
    | "GUEST_PLAYER"
    | "LOCAL";
  registeredUserId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  normalizedName: string;
}

function isUniqueConstraintError(
  error: unknown
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function ownerWhere(
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

function assertDraftMatch(
  match: MatchRecord
): void {
  if (match.status !== "DRAFT") {
    throw new AppError(
      "Only a draft match can be changed.",
      409,
      "MATCH_NOT_EDITABLE"
    );
  }
}

function serializeMatchPlayer(
  player: MatchPlayerRecord
): PublicMatchPlayer {
  return {
    id: player.id,
    source: player.source,
    registeredUserId:
      player.registeredUserId,
    guestPlayerId:
      player.guestPlayerId,
    displayName:
      player.displayName,
    seatNumber:
      player.seatNumber,
    turnOrder:
      player.turnOrder,
    createdAt:
      player.createdAt.toISOString(),
    updatedAt:
      player.updatedAt.toISOString()
  };
}

function serializeMatch(
  match: MatchRecord
): PublicMatch {
  const players = [...match.players]
    .sort(
      (
        first,
        second
      ) =>
        first.seatNumber -
        second.seatNumber
    )
    .map(serializeMatchPlayer);

  const currentPlayer =
    match.currentTurnOrder === null
      ? null
      : players.find(
          (player) =>
            player.turnOrder ===
            match.currentTurnOrder
        ) ?? null;

  return {
    id: match.id,
    name: match.name,
    status: match.status,
    dictionaryPolicy:
      match.dictionaryPolicy,
    dictionaryLexicon:
      match.dictionaryLexicon
        ? {
            code:
              match.dictionaryLexicon.code,
            version:
              match.dictionaryLexicon.version,
            name:
              match.dictionaryLexicon.name
          }
        : null,
    ownerType: match.ownerType,
    currentTurnOrder:
      match.currentTurnOrder,
    currentPlayer,
    playerCount: players.length,
    canEdit:
      match.status === "DRAFT",
    startedAt:
      match.startedAt?.toISOString() ??
      null,
    completedAt:
      match.completedAt?.toISOString() ??
      null,
    cancelledAt:
      match.cancelledAt?.toISOString() ??
      null,
    createdAt:
      match.createdAt.toISOString(),
    updatedAt:
      match.updatedAt.toISOString(),
    players
  };
}

async function findOwnedMatchRecord(
  actor: MatchActor,
  matchId: string
): Promise<MatchRecord> {
  const match =
    await prisma.match.findFirst({
      where: {
        id: matchId,
        ...ownerWhere(actor)
      },
      include: {
        dictionaryLexicon: true,
        players: {
          orderBy: {
            seatNumber: "asc"
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

  return match;
}

async function resolvePlayerIdentity(
  actor: MatchActor,
  input: AddMatchPlayerInput
): Promise<ResolvedPlayerIdentity> {
  if (input.source === "LOCAL") {
    return {
      source: "LOCAL",
      registeredUserId: null,
      guestPlayerId: null,
      displayName:
        input.displayName,
      normalizedName:
        normalizePlayerName(
          input.displayName
        )
    };
  }

  if (
    input.source ===
    "REGISTERED_USER"
  ) {
    if (
      actor.type !==
      "REGISTERED_USER"
    ) {
      throw new AppError(
        "A guest-owned match cannot add a registered player.",
        403,
        "REGISTERED_PLAYER_NOT_ALLOWED"
      );
    }

    const registeredUserId =
      input.registeredUserId ??
      actor.userId;

    if (
      registeredUserId !==
      actor.userId
    ) {
      throw new AppError(
        "You can only add your own registered identity to this match.",
        403,
        "REGISTERED_PLAYER_NOT_ALLOWED"
      );
    }

    const user =
      await prisma.user.findFirst({
        where: {
          id: registeredUserId,
          status: "ACTIVE"
        }
      });

    if (!user) {
      throw new AppError(
        "The registered player could not be found.",
        404,
        "REGISTERED_PLAYER_NOT_FOUND"
      );
    }

    return {
      source:
        "REGISTERED_USER",
      registeredUserId:
        user.id,
      guestPlayerId: null,
      displayName:
        user.displayName,
      normalizedName:
        normalizePlayerName(
          user.displayName
        )
    };
  }

  if (
    actor.type !==
    "GUEST_SESSION"
  ) {
    throw new AppError(
      "Guest players can only be added to a match owned by their guest session.",
      403,
      "GUEST_PLAYER_NOT_ALLOWED"
    );
  }

  const guestPlayer =
    await prisma.guestPlayer.findFirst({
      where: {
        id: input.guestPlayerId,
        guestSessionId:
          actor.guestSessionId
      }
    });

  if (!guestPlayer) {
    throw new AppError(
      "The guest player could not be found.",
      404,
      "GUEST_PLAYER_NOT_FOUND"
    );
  }

  return {
    source: "GUEST_PLAYER",
    registeredUserId: null,
    guestPlayerId:
      guestPlayer.id,
    displayName:
      guestPlayer.displayName,
    normalizedName:
      guestPlayer.normalizedName
  };
}

function assertCompleteOrdering(
  players: MatchPlayerRecord[]
): void {
  const expected = Array.from(
    {
      length: players.length
    },
    (
      _value,
      index
    ) => index + 1
  );

  const seats = players
    .map(
      (player) =>
        player.seatNumber
    )
    .sort(
      (
        first,
        second
      ) => first - second
    );

  const turns = players
    .map(
      (player) =>
        player.turnOrder
    )
    .sort(
      (
        first,
        second
      ) => first - second
    );

  if (
    JSON.stringify(seats) !==
      JSON.stringify(expected) ||
    JSON.stringify(turns) !==
      JSON.stringify(expected)
  ) {
    throw new AppError(
      "Player seating and turn order must be complete before starting.",
      409,
      "MATCH_PLAYER_ORDER_INCOMPLETE"
    );
  }
}

async function resolveDictionaryLexiconForStart(
  match: MatchRecord
): Promise<string | null> {
  if (
    match.dictionaryPolicy !==
    "LOCAL_WORD_LIST"
  ) {
    return null;
  }

  if (match.dictionaryLexiconId) {
    return match.dictionaryLexiconId;
  }

  const currentLexicon =
    await prisma.dictionaryLexicon.findFirst({
      where: {
        code: "LOCAL_STARTER",
        isCurrent: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

  if (!currentLexicon) {
    throw new AppError(
      "The local dictionary is not currently available.",
      503,
      "LOCAL_DICTIONARY_UNAVAILABLE"
    );
  }

  return currentLexicon.id;
}

export async function createMatch(
  actor: MatchActor,
  input: CreateMatchInput
): Promise<PublicMatch> {
  const ownerData =
    actor.type ===
    "REGISTERED_USER"
      ? {
          ownerType:
            "REGISTERED_USER" as const,
          ownerUserId:
            actor.userId,
          ownerGuestSessionId:
            null
        }
      : {
          ownerType:
            "GUEST_SESSION" as const,
          ownerUserId:
            null,
          ownerGuestSessionId:
            actor.guestSessionId
        };

  const match =
    await prisma.match.create({
      data: {
        name: input.name ?? null,
        dictionaryPolicy:
          input.dictionaryPolicy,
        ...ownerData
      },
      include: {
        dictionaryLexicon: true,
        players: {
          orderBy: {
            seatNumber: "asc"
          }
        }
      }
    });

  return getMatch(
    actor,
    match.id
  );
}

export async function listMatches(
  actor: MatchActor
): Promise<PublicMatch[]> {
  const matches =
    await prisma.match.findMany({
      where: ownerWhere(actor),
      include: {
        dictionaryLexicon: true,
        players: {
          orderBy: {
            seatNumber: "asc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

  return matches.map(
    serializeMatch
  );
}

export async function getMatch(
  actor: MatchActor,
  matchId: string
): Promise<PublicMatch> {
  const match =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  return serializeMatch(match);
}

export async function updateDraftMatch(
  actor: MatchActor,
  matchId: string,
  input: UpdateDraftMatchInput
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  assertDraftMatch(existingMatch);

  await prisma.match.update({
      where: {
        id: matchId
      },
      data: {
        ...(input.name !== undefined
          ? {
              name: input.name
            }
          : {}),
        ...(input.dictionaryPolicy !== undefined
          ? {
              dictionaryPolicy:
                input.dictionaryPolicy
            }
          : {})
      },
      include: {
        dictionaryLexicon: true,
        players: {
          orderBy: {
            seatNumber: "asc"
          }
        }
      }
    });

  return getMatch(
    actor,
    matchId
  );
}

export async function addMatchPlayer(
  actor: MatchActor,
  matchId: string,
  input: AddMatchPlayerInput
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  assertDraftMatch(existingMatch);

  if (
    existingMatch.players.length >= 4
  ) {
    throw new AppError(
      "A Scrabble match supports a maximum of four players.",
      409,
      "MATCH_PLAYER_LIMIT_REACHED"
    );
  }

  const identity =
    await resolvePlayerIdentity(
      actor,
      input
    );

  const duplicateIdentity =
    existingMatch.players.some(
      (player) =>
        (
          identity.registeredUserId !==
            null &&
          player.registeredUserId ===
            identity.registeredUserId
        ) ||
        (
          identity.guestPlayerId !==
            null &&
          player.guestPlayerId ===
            identity.guestPlayerId
        )
    );

  if (duplicateIdentity) {
    throw new AppError(
      "This player has already been added to the match.",
      409,
      "MATCH_PLAYER_ALREADY_ADDED"
    );
  }

  const duplicateName =
    existingMatch.players.some(
      (player) =>
        player.normalizedName ===
        identity.normalizedName
    );

  if (duplicateName) {
    throw new AppError(
      "A player with this name already exists in the match.",
      409,
      "MATCH_PLAYER_NAME_ALREADY_EXISTS"
    );
  }

  const nextPosition =
    existingMatch.players.length +
    1;

  try {
    await prisma.matchPlayer.create({
      data: {
        matchId,
        source:
          identity.source,
        registeredUserId:
          identity.registeredUserId,
        guestPlayerId:
          identity.guestPlayerId,
        displayName:
          identity.displayName,
        normalizedName:
          identity.normalizedName,
        seatNumber:
          nextPosition,
        turnOrder:
          nextPosition
      }
    });
  } catch (error) {
    if (
      isUniqueConstraintError(error)
    ) {
      throw new AppError(
        "The player conflicts with an existing match player.",
        409,
        "MATCH_PLAYER_CONFLICT"
      );
    }

    throw error;
  }

  return getMatch(
    actor,
    matchId
  );
}

export async function reorderMatchPlayers(
  actor: MatchActor,
  matchId: string,
  input: ReorderMatchPlayersInput
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  assertDraftMatch(existingMatch);

  const existingIds =
    new Set(
      existingMatch.players.map(
        (player) => player.id
      )
    );

  const suppliedIds =
    new Set(input.seatOrder);

  if (
    existingIds.size !==
      suppliedIds.size ||
    [...existingIds].some(
      (playerId) =>
        !suppliedIds.has(playerId)
    )
  ) {
    throw new AppError(
      "The supplied order must contain every current match player exactly once.",
      400,
      "INVALID_MATCH_PLAYER_ORDER"
    );
  }

  const seatByPlayerId =
    new Map(
      input.seatOrder.map(
        (
          playerId,
          index
        ) => [
          playerId,
          index + 1
        ]
      )
    );

  const turnByPlayerId =
    new Map(
      input.turnOrder.map(
        (
          playerId,
          index
        ) => [
          playerId,
          index + 1
        ]
      )
    );

  const now = new Date();

  await prisma.$transaction(
    async (transaction) => {
      await transaction.matchPlayer.deleteMany({
        where: {
          matchId
        }
      });

      await transaction.matchPlayer.createMany({
        data:
          existingMatch.players.map(
            (player) => ({
              id: player.id,
              matchId,
              source:
                player.source,
              registeredUserId:
                player.registeredUserId,
              guestPlayerId:
                player.guestPlayerId,
              displayName:
                player.displayName,
              normalizedName:
                player.normalizedName,
              seatNumber:
                seatByPlayerId.get(
                  player.id
                ) as number,
              turnOrder:
                turnByPlayerId.get(
                  player.id
                ) as number,
              createdAt:
                player.createdAt,
              updatedAt: now
            })
          )
      });

      await transaction.match.update({
        where: {
          id: matchId
        },
        data: {
          updatedAt: now
        }
      });
    }
  );

  return getMatch(
    actor,
    matchId
  );
}

export async function removeMatchPlayer(
  actor: MatchActor,
  matchId: string,
  playerId: string
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  assertDraftMatch(existingMatch);

  const playerExists =
    existingMatch.players.some(
      (player) =>
        player.id === playerId
    );

  if (!playerExists) {
    throw new AppError(
      "The match player could not be found.",
      404,
      "MATCH_PLAYER_NOT_FOUND"
    );
  }

  const remainingPlayers =
    existingMatch.players.filter(
      (player) =>
        player.id !== playerId
    );

  const seatOrdered =
    [...remainingPlayers].sort(
      (
        first,
        second
      ) =>
        first.seatNumber -
        second.seatNumber
    );

  const turnOrdered =
    [...remainingPlayers].sort(
      (
        first,
        second
      ) =>
        first.turnOrder -
        second.turnOrder
    );

  const seatByPlayerId =
    new Map(
      seatOrdered.map(
        (
          player,
          index
        ) => [
          player.id,
          index + 1
        ]
      )
    );

  const turnByPlayerId =
    new Map(
      turnOrdered.map(
        (
          player,
          index
        ) => [
          player.id,
          index + 1
        ]
      )
    );

  const now = new Date();

  await prisma.$transaction(
    async (transaction) => {
      await transaction.matchPlayer.deleteMany({
        where: {
          matchId
        }
      });

      if (
        remainingPlayers.length > 0
      ) {
        await transaction.matchPlayer.createMany({
          data:
            remainingPlayers.map(
              (player) => ({
                id: player.id,
                matchId,
                source:
                  player.source,
                registeredUserId:
                  player.registeredUserId,
                guestPlayerId:
                  player.guestPlayerId,
                displayName:
                  player.displayName,
                normalizedName:
                  player.normalizedName,
                seatNumber:
                  seatByPlayerId.get(
                    player.id
                  ) as number,
                turnOrder:
                  turnByPlayerId.get(
                    player.id
                  ) as number,
                createdAt:
                  player.createdAt,
                updatedAt: now
              })
            )
        });
      }

      await transaction.match.update({
        where: {
          id: matchId
        },
        data: {
          updatedAt: now
        }
      });
    }
  );

  return getMatch(
    actor,
    matchId
  );
}

export async function startMatch(
  actor: MatchActor,
  matchId: string
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  assertDraftMatch(existingMatch);

  if (
    existingMatch.players.length < 2
  ) {
    throw new AppError(
      "A Scrabble match requires at least two players.",
      409,
      "MATCH_REQUIRES_MORE_PLAYERS"
    );
  }

  if (
    existingMatch.players.length > 4
  ) {
    throw new AppError(
      "A Scrabble match supports a maximum of four players.",
      409,
      "MATCH_PLAYER_LIMIT_REACHED"
    );
  }

  assertCompleteOrdering(
    existingMatch.players
  );

  const dictionaryLexiconId =
    await resolveDictionaryLexiconForStart(
      existingMatch
    );

  const now = new Date();

  const updated =
    await prisma.match.updateMany({
      where: {
        id: matchId,
        status: "DRAFT"
      },
      data: {
        status: "IN_PROGRESS",
        currentTurnOrder: 1,
        startedAt: now,
        cancelledAt: null,
        ...(dictionaryLexiconId !== null
          ? {
              dictionaryLexiconId
            }
          : {})
      }
    });

  if (updated.count !== 1) {
    throw new AppError(
      "The match is no longer available to start.",
      409,
      "MATCH_START_CONFLICT"
    );
  }

  return getMatch(
    actor,
    matchId
  );
}

export async function cancelMatch(
  actor: MatchActor,
  matchId: string
): Promise<PublicMatch> {
  const existingMatch =
    await findOwnedMatchRecord(
      actor,
      matchId
    );

  if (
    existingMatch.status !== "DRAFT" &&
    existingMatch.status !==
      "IN_PROGRESS"
  ) {
    throw new AppError(
      "This match cannot be cancelled.",
      409,
      "MATCH_NOT_CANCELLABLE"
    );
  }

  const now = new Date();

  const updated =
    await prisma.match.updateMany({
      where: {
        id: matchId,
        status: {
          in: [
            "DRAFT",
            "IN_PROGRESS"
          ]
        }
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        currentTurnOrder: null
      }
    });

  if (updated.count !== 1) {
    throw new AppError(
      "The match is no longer available to cancel.",
      409,
      "MATCH_CANCEL_CONFLICT"
    );
  }

  return getMatch(
    actor,
    matchId
  );
}
