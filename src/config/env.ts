import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5050),

  API_VERSION: z
    .string()
    .trim()
    .min(1)
    .default("v1"),

  CORS_ORIGIN: z
    .string()
    .trim()
    .min(1)
    .default("http://localhost:3000"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z
    .string()
    .trim()
    .min(1),

  JWT_ACCESS_SECRET: z
    .string()
    .min(
      32,
      "JWT_ACCESS_SECRET must contain at least 32 characters."
    ),

  JWT_ISSUER: z
    .string()
    .trim()
    .min(1)
    .default("scrabble-calculator-api"),

  JWT_AUDIENCE: z
    .string()
    .trim()
    .min(1)
    .default("scrabble-calculator-web"),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(3600)
    .default(900),

  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),

  GUEST_SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(24)
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnvironment.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = parsedEnvironment.data;
