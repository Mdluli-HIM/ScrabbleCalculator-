import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import {
  normalizePlayerName
} from "../../utils/normalization.js";

import {
  createOpaqueToken,
  hashOpaqueToken
} from "../auth/auth.security.js";

import type {
  CreateGuestPlayerInput
} from "./guest.schemas.js";

import type {
  GuestSessionCreationResult,
  PublicGuestPlayer,
  PublicGuestSession
} from "./guest.types.js";

interface GuestPlayerRecord {
  id: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface GuestSessionRecord {
  id: string;
  expiresAt: Date;
  claimedAt: Date | null;
  claimedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  players: GuestPlayerRecord[];
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

export function serializeGuestPlayer(
  player: GuestPlayerRecord
): PublicGuestPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString()
  };
}

export function serializeGuestSession(
  session: GuestSessionRecord
): PublicGuestSession {
  return {
    id: session.id,
    expiresAt: session.expiresAt.toISOString(),
    claimedAt:
      session.claimedAt?.toISOString() ?? null,
    claimedByUserId:
      session.claimedByUserId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    players: session.players.map(
      serializeGuestPlayer
    )
  };
}

function createGuestSessionExpiry(): Date {
  return new Date(
    Date.now() +
      env.GUEST_SESSION_TTL_HOURS *
        60 *
        60 *
        1000
  );
}

export async function createGuestSession():
  Promise<GuestSessionCreationResult> {
  const guestSessionToken =
    createOpaqueToken();

  const tokenHash =
    hashOpaqueToken(guestSessionToken);

  const expiresAt =
    createGuestSessionExpiry();

  const guestSession =
    await prisma.guestSession.create({
      data: {
        tokenHash,
        expiresAt
      },
      include: {
        players: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

  return {
    guestSessionToken,
    guestSession:
      serializeGuestSession(guestSession)
  };
}

export async function getGuestSession(
  guestSessionId: string
): Promise<PublicGuestSession> {
  const guestSession =
    await prisma.guestSession.findUnique({
      where: {
        id: guestSessionId
      },
      include: {
        players: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

  if (!guestSession) {
    throw new AppError(
      "The guest session could not be found.",
      404,
      "GUEST_SESSION_NOT_FOUND"
    );
  }

  return serializeGuestSession(
    guestSession
  );
}

export async function createGuestPlayer(
  guestSessionId: string,
  input: CreateGuestPlayerInput
): Promise<PublicGuestPlayer> {
  const normalizedName =
    normalizePlayerName(
      input.displayName
    );

  try {
    const player =
      await prisma.$transaction(
        async (transaction) => {
          const playerCount =
            await transaction.guestPlayer.count({
              where: {
                guestSessionId
              }
            });

          if (playerCount >= 4) {
            throw new AppError(
              "A guest session can contain a maximum of four players.",
              409,
              "GUEST_PLAYER_LIMIT_REACHED"
            );
          }

          return transaction.guestPlayer.create({
            data: {
              guestSessionId,
              displayName:
                input.displayName,
              normalizedName
            }
          });
        }
      );

    return serializeGuestPlayer(player);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "A player with this name already exists in the guest session.",
        409,
        "GUEST_PLAYER_ALREADY_EXISTS"
      );
    }

    throw error;
  }
}

export async function listGuestPlayers(
  guestSessionId: string
): Promise<PublicGuestPlayer[]> {
  const players =
    await prisma.guestPlayer.findMany({
      where: {
        guestSessionId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

  return players.map(
    serializeGuestPlayer
  );
}

export async function removeGuestPlayer(
  guestSessionId: string,
  playerId: string
): Promise<void> {
  const deletedPlayer =
    await prisma.guestPlayer.deleteMany({
      where: {
        id: playerId,
        guestSessionId
      }
    });

  if (deletedPlayer.count !== 1) {
    throw new AppError(
      "The guest player could not be found.",
      404,
      "GUEST_PLAYER_NOT_FOUND"
    );
  }
}

export async function claimGuestSession(
  guestSessionId: string,
  userId: string
): Promise<PublicGuestSession> {
  const now = new Date();

  const claimedSession =
    await prisma.$transaction(
      async (transaction) => {
        const updated =
          await transaction.guestSession.updateMany({
            where: {
              id: guestSessionId,
              claimedAt: null,
              claimedByUserId: null,
              expiresAt: {
                gt: now
              }
            },
            data: {
              claimedAt: now,
              claimedByUserId: userId
            }
          });

        if (updated.count !== 1) {
          throw new AppError(
            "The guest session cannot be claimed.",
            409,
            "GUEST_SESSION_NOT_CLAIMABLE"
          );
        }

        return transaction.guestSession.findUniqueOrThrow({
          where: {
            id: guestSessionId
          },
          include: {
            players: {
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        });
      }
    );

  return serializeGuestSession(
    claimedSession
  );
}
