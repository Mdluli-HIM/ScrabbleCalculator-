import type {
  RequestHandler
} from "express";

import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import {
  asyncHandler
} from "../../utils/async-handler.js";

import {
  hashOpaqueToken
} from "../auth/auth.security.js";

import type {
  GuestSessionContext
} from "./guest.types.js";

export const requireGuestSession: RequestHandler =
  asyncHandler(
    async (
      request,
      response,
      next
    ) => {
      const guestSessionToken =
        request
          .header(
            "x-guest-session-token"
          )
          ?.trim();

      if (!guestSessionToken) {
        throw new AppError(
          "A guest session token is required.",
          401,
          "GUEST_SESSION_REQUIRED"
        );
      }

      const tokenHash =
        hashOpaqueToken(
          guestSessionToken
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

      const guestContext:
        GuestSessionContext = {
          guestSessionId:
            guestSession.id,
          expiresAt:
            guestSession.expiresAt.toISOString()
        };

      response.locals.guest =
        guestContext;

      next();
    }
  );
