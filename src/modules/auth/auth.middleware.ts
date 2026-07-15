import type {
  RequestHandler
} from "express";

import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import { asyncHandler } from "../../utils/async-handler.js";

import {
  verifyAccessToken
} from "./auth.security.js";

import {
  serializeUser
} from "./auth.service.js";

import type {
  AuthenticationContext
} from "./auth.types.js";

export const requireAuthentication: RequestHandler =
  asyncHandler(
    async (
      request,
      response,
      next
    ) => {
      const authorizationHeader =
        request.header("authorization");

      if (!authorizationHeader) {
        throw new AppError(
          "Authentication is required.",
          401,
          "AUTHENTICATION_REQUIRED"
        );
      }

      const [
        scheme,
        token
      ] = authorizationHeader.split(" ");

      if (
        scheme?.toLowerCase() !== "bearer" ||
        !token
      ) {
        throw new AppError(
          "Use a valid Bearer access token.",
          401,
          "INVALID_AUTHORIZATION_HEADER"
        );
      }

      const claims =
        await verifyAccessToken(token);

      const session =
        await prisma.refreshSession.findUnique({
          where: {
            id: claims.sessionId
          },
          include: {
            user: true
          }
        });

      const now = new Date();

      if (
        !session ||
        session.userId !== claims.userId ||
        session.revokedAt ||
        session.expiresAt <= now
      ) {
        throw new AppError(
          "The authentication session is no longer active.",
          401,
          "AUTHENTICATION_SESSION_INACTIVE"
        );
      }

      if (session.user.status !== "ACTIVE") {
        throw new AppError(
          "This account is currently disabled.",
          403,
          "ACCOUNT_DISABLED"
        );
      }

      const authenticationContext:
        AuthenticationContext = {
          userId: session.userId,
          sessionId: session.id,
          user: serializeUser(
            session.user
          )
        };

      response.locals.auth =
        authenticationContext;

      next();
    }
  );
