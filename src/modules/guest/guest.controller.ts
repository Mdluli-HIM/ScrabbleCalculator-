import type {
  Request,
  Response
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  sendSuccess
} from "../../utils/api-response.js";

import type {
  AuthenticationContext
} from "../auth/auth.types.js";

import {
  createGuestPlayerSchema,
  guestPlayerParamsSchema
} from "./guest.schemas.js";

import {
  claimGuestSession,
  createGuestPlayer,
  createGuestSession,
  getGuestSession,
  listGuestPlayers,
  removeGuestPlayer
} from "./guest.service.js";

import type {
  GuestSessionContext
} from "./guest.types.js";

function getGuestContext(
  response: Response
): GuestSessionContext {
  const guest =
    response.locals.guest as
      | GuestSessionContext
      | undefined;

  if (!guest) {
    throw new AppError(
      "A guest session is required.",
      401,
      "GUEST_SESSION_REQUIRED"
    );
  }

  return guest;
}

export async function startGuestSession(
  _request: Request,
  response: Response
): Promise<Response> {
  const result =
    await createGuestSession();

  return sendSuccess(
    response,
    201,
    "Guest session created successfully.",
    result
  );
}

export async function getCurrentGuestSession(
  _request: Request,
  response: Response
): Promise<Response> {
  const guest =
    getGuestContext(response);

  const guestSession =
    await getGuestSession(
      guest.guestSessionId
    );

  return sendSuccess(
    response,
    200,
    "Guest session retrieved successfully.",
    {
      guestSession
    }
  );
}

export async function addGuestPlayer(
  request: Request,
  response: Response
): Promise<Response> {
  const guest =
    getGuestContext(response);

  const input =
    createGuestPlayerSchema.parse(
      request.body
    );

  const player =
    await createGuestPlayer(
      guest.guestSessionId,
      input
    );

  return sendSuccess(
    response,
    201,
    "Guest player added successfully.",
    {
      player
    }
  );
}

export async function getGuestPlayers(
  _request: Request,
  response: Response
): Promise<Response> {
  const guest =
    getGuestContext(response);

  const players =
    await listGuestPlayers(
      guest.guestSessionId
    );

  return sendSuccess(
    response,
    200,
    "Guest players retrieved successfully.",
    {
      players,
      total: players.length
    }
  );
}

export async function deleteGuestPlayer(
  request: Request,
  response: Response
): Promise<Response> {
  const guest =
    getGuestContext(response);

  const params =
    guestPlayerParamsSchema.parse(
      request.params
    );

  await removeGuestPlayer(
    guest.guestSessionId,
    params.playerId
  );

  return sendSuccess(
    response,
    200,
    "Guest player removed successfully.",
    {
      removed: true,
      playerId: params.playerId
    }
  );
}

export async function claimCurrentGuestSession(
  _request: Request,
  response: Response
): Promise<Response> {
  const guest =
    getGuestContext(response);

  const authentication =
    response.locals.auth as
      | AuthenticationContext
      | undefined;

  if (!authentication) {
    throw new AppError(
      "Authentication is required to claim a guest session.",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  const guestSession =
    await claimGuestSession(
      guest.guestSessionId,
      authentication.userId
    );

  return sendSuccess(
    response,
    200,
    "Guest session claimed successfully.",
    {
      guestSession
    }
  );
}
