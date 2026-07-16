import type {
  Request,
  Response
} from "express";

import { AppError } from "../../errors/app-error.js";

import {
  sendSuccess
} from "../../utils/api-response.js";

import {
  matchParamsSchema
} from "../matches/match.schemas.js";

import type {
  MatchActor
} from "../matches/match.types.js";

import {
  completeMatchSchema
} from "./end-game.schemas.js";

import {
  completeMatch,
  getMatchResult
} from "./end-game.service.js";

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

export async function completeMatchHandler(
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
    completeMatchSchema.parse(
      request.body
    );

  const result =
    await completeMatch(
      actor,
      params.matchId,
      input
    );

  return sendSuccess(
    response,
    200,
    "Match completed successfully.",
    {
      result
    }
  );
}

export async function getMatchResultHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const result =
    await getMatchResult(
      actor,
      params.matchId
    );

  return sendSuccess(
    response,
    200,
    "Match result retrieved successfully.",
    {
      result
    }
  );
}
