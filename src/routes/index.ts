import { Router } from "express";

import {
  authRouter
} from "../modules/auth/auth.routes.js";

import {
  guestRouter
} from "../modules/guest/guest.routes.js";

import {
  healthRouter
} from "../modules/health/health.routes.js";

export const apiRouter = Router();

apiRouter.use(
  "/health",
  healthRouter
);

apiRouter.use(
  "/auth",
  authRouter
);

apiRouter.use(
  "/guest",
  guestRouter
);
