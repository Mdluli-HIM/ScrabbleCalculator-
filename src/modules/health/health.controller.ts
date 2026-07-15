import type {
  Request,
  Response
} from "express";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";
import { sendSuccess } from "../../utils/api-response.js";

export function getApiHealth(
  _request: Request,
  response: Response
): Response {
  return sendSuccess(
    response,
    200,
    "API is healthy.",
    {
      service: "scrabble-calculator-api",
      version: "0.1.0",
      status: "healthy",
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? "development"
    }
  );
}

export async function getDatabaseHealth(
  _request: Request,
  response: Response
): Promise<Response> {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const latencyMs = Number(
      (performance.now() - startedAt).toFixed(2)
    );

    return sendSuccess(
      response,
      200,
      "Database connection is healthy.",
      {
        status: "connected",
        latencyMs
      }
    );
  } catch {
    throw new AppError(
      "The database is currently unavailable.",
      503,
      "DATABASE_UNAVAILABLE"
    );
  }
}
