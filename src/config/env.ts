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
    .min(1)
    .default(
      "postgresql://scrabble_user:scrabble_password@localhost:5440/scrabble_calculator?schema=public"
    )
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
