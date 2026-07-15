import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";

import {
  getCurrentUser,
  login,
  logout,
  refresh,
  register
} from "./auth.controller.js";

import {
  requireAuthentication
} from "./auth.middleware.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(register)
);

authRouter.post(
  "/login",
  asyncHandler(login)
);

authRouter.post(
  "/refresh",
  asyncHandler(refresh)
);

authRouter.post(
  "/logout",
  asyncHandler(logout)
);

authRouter.get(
  "/me",
  requireAuthentication,
  getCurrentUser
);
