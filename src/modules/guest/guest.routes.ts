import { Router } from "express";

import {
  requireAuthentication
} from "../auth/auth.middleware.js";

import {
  addGuestPlayer,
  claimCurrentGuestSession,
  deleteGuestPlayer,
  getCurrentGuestSession,
  getGuestPlayers,
  startGuestSession
} from "./guest.controller.js";

import {
  requireGuestSession
} from "./guest.middleware.js";

import {
  asyncHandler
} from "../../utils/async-handler.js";

export const guestRouter = Router();

guestRouter.post(
  "/sessions",
  asyncHandler(startGuestSession)
);

guestRouter.get(
  "/sessions/current",
  requireGuestSession,
  asyncHandler(
    getCurrentGuestSession
  )
);

guestRouter.post(
  "/players",
  requireGuestSession,
  asyncHandler(addGuestPlayer)
);

guestRouter.get(
  "/players",
  requireGuestSession,
  asyncHandler(getGuestPlayers)
);

guestRouter.delete(
  "/players/:playerId",
  requireGuestSession,
  asyncHandler(deleteGuestPlayer)
);

guestRouter.post(
  "/claim",
  requireAuthentication,
  requireGuestSession,
  asyncHandler(
    claimCurrentGuestSession
  )
);
