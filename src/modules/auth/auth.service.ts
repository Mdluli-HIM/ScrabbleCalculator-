import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";

import {
  createRefreshTokenExpiry,
  hashPassword,
  signAccessToken,
  verifyPassword
} from "./auth.security.js";

import {
  createOpaqueToken,
  hashOpaqueToken
} from "../../utils/opaque-token.js";

import type {
  LoginInput,
  RegisterInput
} from "./auth.schemas.js";

import type {
  AuthenticationResult,
  PublicUser
} from "./auth.types.js";

interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

export function serializeUser(
  user: UserRecord
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    lastLoginAt:
      user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

async function createAuthenticationResult(
  user: UserRecord,
  refreshSessionId: string,
  refreshToken: string,
  refreshTokenExpiresAt: Date
): Promise<AuthenticationResult> {
  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: refreshSessionId
  });

  return {
    user: serializeUser(user),

    tokens: {
      accessToken,
      accessTokenType: "Bearer",
      accessTokenExpiresInSeconds:
        env.ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
      refreshTokenExpiresAt:
        refreshTokenExpiresAt.toISOString()
    }
  };
}

export async function registerUser(
  input: RegisterInput
): Promise<AuthenticationResult> {
  const existingUser =
    await prisma.user.findUnique({
      where: {
        email: input.email
      },
      select: {
        id: true
      }
    });

  if (existingUser) {
    throw new AppError(
      "An account already exists for this email address.",
      409,
      "EMAIL_ALREADY_REGISTERED"
    );
  }

  const passwordHash = await hashPassword(
    input.password
  );

  const refreshToken = createOpaqueToken();
  const refreshTokenHash =
    hashOpaqueToken(refreshToken);
  const refreshTokenExpiresAt =
    createRefreshTokenExpiry();

  try {
    const {
      user,
      refreshSession
    } = await prisma.$transaction(
      async (transaction) => {
        const createdUser =
          await transaction.user.create({
            data: {
              email: input.email,
              displayName: input.displayName,
              passwordHash
            }
          });

        const createdRefreshSession =
          await transaction.refreshSession.create({
            data: {
              userId: createdUser.id,
              tokenHash: refreshTokenHash,
              expiresAt:
                refreshTokenExpiresAt
            }
          });

        return {
          user: createdUser,
          refreshSession:
            createdRefreshSession
        };
      }
    );

    return createAuthenticationResult(
      user,
      refreshSession.id,
      refreshToken,
      refreshTokenExpiresAt
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "An account already exists for this email address.",
        409,
        "EMAIL_ALREADY_REGISTERED"
      );
    }

    throw error;
  }
}

export async function loginUser(
  input: LoginInput
): Promise<AuthenticationResult> {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  const passwordIsValid =
    user
      ? await verifyPassword(
          user.passwordHash,
          input.password
        )
      : false;

  if (!user || !passwordIsValid) {
    throw new AppError(
      "The email address or password is incorrect.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(
      "This account is currently disabled.",
      403,
      "ACCOUNT_DISABLED"
    );
  }

  const refreshToken = createOpaqueToken();
  const refreshTokenHash =
    hashOpaqueToken(refreshToken);
  const refreshTokenExpiresAt =
    createRefreshTokenExpiry();

  const {
    updatedUser,
    refreshSession
  } = await prisma.$transaction(
    async (transaction) => {
      const currentUser =
        await transaction.user.update({
          where: {
            id: user.id
          },
          data: {
            lastLoginAt: new Date()
          }
        });

      const createdRefreshSession =
        await transaction.refreshSession.create({
          data: {
            userId: user.id,
            tokenHash: refreshTokenHash,
            expiresAt:
              refreshTokenExpiresAt
          }
        });

      return {
        updatedUser: currentUser,
        refreshSession:
          createdRefreshSession
      };
    }
  );

  return createAuthenticationResult(
    updatedUser,
    refreshSession.id,
    refreshToken,
    refreshTokenExpiresAt
  );
}

export async function refreshUserSession(
  currentRefreshToken: string
): Promise<AuthenticationResult> {
  const currentTokenHash =
    hashOpaqueToken(currentRefreshToken);

  const currentSession =
    await prisma.refreshSession.findUnique({
      where: {
        tokenHash: currentTokenHash
      },
      include: {
        user: true
      }
    });

  const now = new Date();

  if (
    !currentSession ||
    currentSession.revokedAt ||
    currentSession.expiresAt <= now
  ) {
    throw new AppError(
      "The refresh token is invalid or has expired.",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  if (currentSession.user.status !== "ACTIVE") {
    throw new AppError(
      "This account is currently disabled.",
      403,
      "ACCOUNT_DISABLED"
    );
  }

  const newRefreshToken =
    createOpaqueToken();
  const newRefreshTokenHash =
    hashOpaqueToken(newRefreshToken);
  const newRefreshTokenExpiresAt =
    createRefreshTokenExpiry();

  const newRefreshSession =
    await prisma.$transaction(
      async (transaction) => {
        const revokedSession =
          await transaction.refreshSession.updateMany({
            where: {
              id: currentSession.id,
              revokedAt: null,
              expiresAt: {
                gt: now
              }
            },
            data: {
              revokedAt: now,
              lastUsedAt: now
            }
          });

        if (revokedSession.count !== 1) {
          throw new AppError(
            "The refresh token has already been used.",
            401,
            "REFRESH_TOKEN_REUSED"
          );
        }

        return transaction.refreshSession.create({
          data: {
            userId: currentSession.userId,
            tokenHash:
              newRefreshTokenHash,
            expiresAt:
              newRefreshTokenExpiresAt
          }
        });
      }
    );

  return createAuthenticationResult(
    currentSession.user,
    newRefreshSession.id,
    newRefreshToken,
    newRefreshTokenExpiresAt
  );
}

export async function logoutUser(
  refreshToken: string
): Promise<void> {
  const tokenHash =
    hashOpaqueToken(refreshToken);

  await prisma.refreshSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}
