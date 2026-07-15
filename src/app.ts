import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { apiRouter } from "./routes/index.js";
import { sendSuccess } from "./utils/api-response.js";

export const app = express();

app.disable("x-powered-by");

app.use(requestContext);

app.use(
  pinoHttp({
    logger
  })
);

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    credentials: true
  })
);

app.use(compression());

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

app.get("/", (_request, response) => {
  return sendSuccess(
    response,
    200,
    "Welcome to the ScrabbleCalculator API.",
    {
      service: "scrabble-calculator-api",
      apiVersion: env.API_VERSION,
      healthEndpoint: `/api/${env.API_VERSION}/health`
    }
  );
});

app.use(`/api/${env.API_VERSION}`, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
