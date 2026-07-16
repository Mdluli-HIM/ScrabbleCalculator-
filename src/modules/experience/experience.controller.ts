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
  getMatchExperience
} from "./experience.service.js";

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

export async function getMatchExperienceHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const experience =
    await getMatchExperience(
      actor,
      params.matchId
    );

  return sendSuccess(
    response,
    200,
    "Match experience retrieved successfully.",
    {
      experience
    }
  );
}
