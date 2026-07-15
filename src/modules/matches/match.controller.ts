import type {
  Request,
  Response
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  sendSuccess
} from "../../utils/api-response.js";

import {
  addMatchPlayerSchema,
  createMatchSchema,
  emptyMatchActionSchema,
  matchParamsSchema,
  matchPlayerParamsSchema,
  reorderMatchPlayersSchema,
  updateDraftMatchSchema
} from "./match.schemas.js";

import {
  addMatchPlayer,
  cancelMatch,
  createMatch,
  getMatch,
  listMatches,
  removeMatchPlayer,
  reorderMatchPlayers,
  startMatch,
  updateDraftMatch
} from "./match.service.js";

import type {
  MatchActor
} from "./match.types.js";

function getMatchActor(
  response: Response
): MatchActor {
  const actor =
    response.locals.matchActor as
      | MatchActor
      | undefined;

  if (!actor) {
    throw new AppError(
      "Registered authentication or a guest session token is required.",
      401,
      "MATCH_ACTOR_REQUIRED"
    );
  }

  return actor;
}

export async function createMatchHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const input =
    createMatchSchema.parse(
      request.body
    );

  const match =
    await createMatch(
      actor,
      input
    );

  return sendSuccess(
    response,
    201,
    "Match draft created successfully.",
    {
      match
    }
  );
}

export async function listMatchesHandler(
  _request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const matches =
    await listMatches(actor);

  return sendSuccess(
    response,
    200,
    "Matches retrieved successfully.",
    {
      matches,
      total: matches.length
    }
  );
}

export async function getMatchHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const match =
    await getMatch(
      actor,
      params.matchId
    );

  return sendSuccess(
    response,
    200,
    "Match retrieved successfully.",
    {
      match
    }
  );
}

export async function updateMatchHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const input =
    updateDraftMatchSchema.parse(
      request.body
    );

  const match =
    await updateDraftMatch(
      actor,
      params.matchId,
      input
    );

  return sendSuccess(
    response,
    200,
    "Match draft updated successfully.",
    {
      match
    }
  );
}

export async function addMatchPlayerHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const input =
    addMatchPlayerSchema.parse(
      request.body
    );

  const match =
    await addMatchPlayer(
      actor,
      params.matchId,
      input
    );

  return sendSuccess(
    response,
    201,
    "Player added to the match successfully.",
    {
      match
    }
  );
}

export async function reorderMatchPlayersHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const input =
    reorderMatchPlayersSchema.parse(
      request.body
    );

  const match =
    await reorderMatchPlayers(
      actor,
      params.matchId,
      input
    );

  return sendSuccess(
    response,
    200,
    "Match player order updated successfully.",
    {
      match
    }
  );
}

export async function removeMatchPlayerHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchPlayerParamsSchema.parse(
      request.params
    );

  const match =
    await removeMatchPlayer(
      actor,
      params.matchId,
      params.playerId
    );

  return sendSuccess(
    response,
    200,
    "Player removed from the match successfully.",
    {
      match,
      removedPlayerId:
        params.playerId
    }
  );
}

export async function startMatchHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  emptyMatchActionSchema.parse(
    request.body ?? {}
  );

  const match =
    await startMatch(
      actor,
      params.matchId
    );

  return sendSuccess(
    response,
    200,
    "Match started successfully.",
    {
      match
    }
  );
}

export async function cancelMatchHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  emptyMatchActionSchema.parse(
    request.body ?? {}
  );

  const match =
    await cancelMatch(
      actor,
      params.matchId
    );

  return sendSuccess(
    response,
    200,
    "Match cancelled successfully.",
    {
      match
    }
  );
}
