import {
  createHash,
  randomBytes,
  randomUUID
} from "node:crypto";

import argon2 from "argon2";
import {
  jwtVerify,
  SignJWT
} from "jose";

import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";

import type {
  AccessTokenClaims
} from "./auth.types.js";

const accessTokenSecret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET
);

export async function hashPassword(
  password: string
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(
      passwordHash,
      password
    );
  } catch {
    return false;
  }
}

export function createOpaqueToken(): string {
  return randomBytes(48).toString(
    "base64url"
  );
}

export function hashOpaqueToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createRefreshTokenExpiry(): Date {
  const expiresAt = new Date();

  expiresAt.setUTCDate(
    expiresAt.getUTCDate() +
      env.REFRESH_TOKEN_TTL_DAYS
  );

  return expiresAt;
}

export async function signAccessToken(
  claims: AccessTokenClaims
): Promise<string> {
  const nowInSeconds = Math.floor(
    Date.now() / 1000
  );

  return new SignJWT({
    type: "access",
    sessionId: claims.sessionId
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT"
    })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setSubject(claims.userId)
    .setIssuedAt(nowInSeconds)
    .setExpirationTime(
      nowInSeconds +
        env.ACCESS_TOKEN_TTL_SECONDS
    )
    .setJti(randomUUID())
    .sign(accessTokenSecret);
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenClaims> {
  try {
    const {
      payload
    } = await jwtVerify(
      token,
      accessTokenSecret,
      {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ["HS256"]
      }
    );

    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string"
    ) {
      throw new AppError(
        "The access token is invalid.",
        401,
        "INVALID_ACCESS_TOKEN"
      );
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "The access token is invalid or has expired.",
      401,
      "INVALID_ACCESS_TOKEN"
    );
  }
}
