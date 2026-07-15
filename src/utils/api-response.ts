import type { Response } from "express";

interface ApiMeta {
  requestId: string;
  timestamp: string;
}

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta: ApiMeta;
}

interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

function createMeta(response: Response): ApiMeta {
  return {
    requestId:
      typeof response.locals.requestId === "string"
        ? response.locals.requestId
        : "unknown",

    timestamp: new Date().toISOString()
  };
}

export function sendSuccess<T>(
  response: Response,
  statusCode: number,
  message: string,
  data: T
): Response<SuccessResponse<T>> {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    meta: createMeta(response)
  });
}

export function sendError(
  response: Response,
  statusCode: number,
  message: string,
  code: string,
  details?: unknown
): Response<ErrorResponse> {
  const errorBody: ErrorResponse["error"] = {
    code
  };

  if (details !== undefined) {
    errorBody.details = details;
  }

  return response.status(statusCode).json({
    success: false,
    message,
    error: errorBody,
    meta: createMeta(response)
  });
}
