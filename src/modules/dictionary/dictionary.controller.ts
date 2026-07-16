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
  validateDictionaryWordsSchema
} from "./dictionary.schemas.js";

import {
  validateDictionaryWords
} from "./dictionary.service.js";

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

export async function validateDictionaryWordsHandler(
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
    validateDictionaryWordsSchema.parse(
      request.body
    );

  const validation =
    await validateDictionaryWords(
      actor,
      params.matchId,
      input
    );

  return sendSuccess(
    response,
    200,
    validation.accepted
      ? "All submitted words are valid."
      : "One or more submitted words are invalid.",
    {
      validation
    }
  );
}
