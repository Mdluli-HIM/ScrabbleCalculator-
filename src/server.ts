import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/database.js";
import { logger } from "./lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      healthEndpoint:
        `http://localhost:${env.PORT}/api/${env.API_VERSION}/health`
    },
    "ScrabbleCalculator API started."
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info(
    {
      signal
    },
    "Graceful shutdown started."
  );

  server.close(async (serverError) => {
    if (serverError) {
      logger.error(
        {
          error: serverError
        },
        "The HTTP server could not close cleanly."
      );

      process.exit(1);
    }

    try {
      await prisma.$disconnect();

      logger.info("Database connection closed.");

      process.exit(0);
    } catch (databaseError) {
      logger.error(
        {
          error: databaseError
        },
        "Database disconnection failed."
      );

      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
