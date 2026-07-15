import type {
  RequestHandler
} from "express";

import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import {
  asyncHandler
} from "../../utils/async-handler.js";

import {
  hashOpaqueToken,
  verifyAccessToken
} from "../auth/auth.security.js";

import type {
  MatchActor
} from "./match.types.js";

function setMatchActor(
  responseLocals: Record<string, unknown>,
  actor: MatchActor
): void {
  responseLocals.matchActor = actor;
}

export const resolveMatchActor: RequestHandler =
  asyncHandler(
    async (
      request,
      response,
      next
    ) => {
      const authorizationHeader =
        request
          .header("authorization")
          ?.trim();

      const guestSessionToken =
        request
          .header(
            "x-guest-session-token"
          )
          ?.trim();

      if (
        authorizationHeader &&
        guestSessionToken
      ) {
        throw new AppError(
          "Use either registered authentication or a guest session token, not both.",
          400,
          "AMBIGUOUS_MATCH_AUTHENTICATION"
        );
      }

      if (
        !authorizationHeader &&
        !guestSessionToken
      ) {
        throw new AppError(
          "Registered authentication or a guest session token is required.",
          401,
          "MATCH_ACTOR_REQUIRED"
        );
      }

      if (authorizationHeader) {
        const [
          scheme,
          accessToken
        ] =
          authorizationHeader.split(
            /\s+/
          );

        if (
          scheme?.toLowerCase() !==
            "bearer" ||
          !accessToken
        ) {
          throw new AppError(
            "Use a valid Bearer access token.",
            401,
            "INVALID_AUTHORIZATION_HEADER"
          );
        }

        const claims =
          await verifyAccessToken(
            accessToken
          );

        const session =
          await prisma.refreshSession.findUnique({
            where: {
              id: claims.sessionId
            },
            include: {
              user: true
            }
          });

        if (
          !session ||
          session.userId !==
            claims.userId ||
          session.revokedAt ||
          session.expiresAt <=
            new Date()
        ) {
          throw new AppError(
            "The authentication session is no longer active.",
            401,
            "AUTHENTICATION_SESSION_INACTIVE"
          );
        }

        if (
          session.user.status !==
          "ACTIVE"
        ) {
          throw new AppError(
            "This account is currently disabled.",
            403,
            "ACCOUNT_DISABLED"
          );
        }

        setMatchActor(
          response.locals,
          {
            type:
              "REGISTERED_USER",
            userId:
              session.userId,
            sessionId:
              session.id
          }
        );

        next();
        return;
      }

      const tokenHash =
        hashOpaqueToken(
          guestSessionToken as string
        );

      const guestSession =
        await prisma.guestSession.findUnique({
          where: {
            tokenHash
          }
        });

      if (
        !guestSession ||
        guestSession.expiresAt <=
          new Date()
      ) {
        throw new AppError(
          "The guest session token is invalid or has expired.",
          401,
          "INVALID_GUEST_SESSION_TOKEN"
        );
      }

      if (
        guestSession.claimedAt ||
        guestSession.claimedByUserId
      ) {
        throw new AppError(
          "This guest session has already been claimed.",
          409,
          "GUEST_SESSION_ALREADY_CLAIMED"
        );
      }

      setMatchActor(
        response.locals,
        {
          type: "GUEST_SESSION",
          guestSessionId:
            guestSession.id,
          expiresAt:
            guestSession.expiresAt.toISOString()
        }
      );

      next();
    }
  );
