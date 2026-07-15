import type {
  Request,
  Response
} from "express";

import { AppError } from "../../errors/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";

import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema
} from "./auth.schemas.js";

import {
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser
} from "./auth.service.js";

import type {
  AuthenticationContext
} from "./auth.types.js";

export async function register(
  request: Request,
  response: Response
): Promise<Response> {
  const input = registerSchema.parse(
    request.body
  );

  const authentication =
    await registerUser(input);

  return sendSuccess(
    response,
    201,
    "Account created successfully.",
    authentication
  );
}

export async function login(
  request: Request,
  response: Response
): Promise<Response> {
  const input = loginSchema.parse(
    request.body
  );

  const authentication =
    await loginUser(input);

  return sendSuccess(
    response,
    200,
    "Login successful.",
    authentication
  );
}

export async function refresh(
  request: Request,
  response: Response
): Promise<Response> {
  const input = refreshSchema.parse(
    request.body
  );

  const authentication =
    await refreshUserSession(
      input.refreshToken
    );

  return sendSuccess(
    response,
    200,
    "Authentication session refreshed.",
    authentication
  );
}

export async function logout(
  request: Request,
  response: Response
): Promise<Response> {
  const input = logoutSchema.parse(
    request.body
  );

  await logoutUser(input.refreshToken);

  return sendSuccess(
    response,
    200,
    "Logout successful.",
    {
      revoked: true
    }
  );
}

export function getCurrentUser(
  _request: Request,
  response: Response
): Response {
  const authentication =
    response.locals.auth as
      | AuthenticationContext
      | undefined;

  if (!authentication) {
    throw new AppError(
      "Authentication is required.",
      401,
      "AUTHENTICATION_REQUIRED"
    );
  }

  return sendSuccess(
    response,
    200,
    "Current user retrieved successfully.",
    {
      user: authentication.user
    }
  );
}
