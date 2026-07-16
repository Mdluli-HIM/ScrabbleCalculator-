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
  submitTurnSchema
} from "./turn.schemas.js";

import {
  submitTurn
} from "./turn.service.js";

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

function getIdempotencyKey(
  request: Request
): string {
  const rawKey =
    request.get(
      "Idempotency-Key"
    );

  if (!rawKey) {
    throw new AppError(
      "An Idempotency-Key header is required.",
      400,
      "IDEMPOTENCY_KEY_REQUIRED"
    );
  }

  const key =
    rawKey.trim();

  if (
    key.length < 8 ||
    key.length > 120
  ) {
    throw new AppError(
      "The Idempotency-Key header must contain between 8 and 120 characters.",
      400,
      "IDEMPOTENCY_KEY_INVALID"
    );
  }

  return key;
}

export async function submitTurnHandler(
  request: Request,
  response: Response
): Promise<Response> {
  const actor =
    getMatchActor(response);

  const params =
    matchParamsSchema.parse(
      request.params
    );

  const idempotencyKey =
    getIdempotencyKey(request);

  const input =
    submitTurnSchema.parse(
      request.body
    );

  const result =
    await submitTurn(
      actor,
      params.matchId,
      idempotencyKey,
      input
    );

  return sendSuccess(
    response,
    result.replayed
      ? 200
      : 201,
    result.replayed
      ? "Turn submission replayed successfully."
      : "Turn submitted successfully.",
    result
  );
}
