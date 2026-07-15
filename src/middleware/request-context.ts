import { randomUUID } from "node:crypto";
import type {
  NextFunction,
  Request,
  Response
} from "express";

export function requestContext(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const suppliedRequestId = request.header("x-request-id")?.trim();

  const requestId =
    suppliedRequestId && suppliedRequestId.length > 0
      ? suppliedRequestId
      : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  next();
}
