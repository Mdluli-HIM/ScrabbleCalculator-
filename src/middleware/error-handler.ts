import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../utils/api-response.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    sendError(
      response,
      400,
      "The submitted data is invalid.",
      "VALIDATION_ERROR",
      error.flatten()
    );

    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(
        {
          error,
          requestId: response.locals.requestId
        },
        error.message
      );
    }

    sendError(
      response,
      error.statusCode,
      error.message,
      error.code,
      error.details
    );

    return;
  }

  logger.error(
    {
      error,
      requestId: response.locals.requestId
    },
    "An unexpected error occurred."
  );

  sendError(
    response,
    500,
    "An unexpected server error occurred.",
    "INTERNAL_SERVER_ERROR",
    env.NODE_ENV === "development" && error instanceof Error
      ? {
          name: error.name,
          message: error.message
        }
      : undefined
  );
};
