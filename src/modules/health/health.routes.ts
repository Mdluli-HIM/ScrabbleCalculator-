import { Router } from "express";
import {
  getApiHealth,
  getDatabaseHealth
} from "./health.controller.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const healthRouter = Router();

healthRouter.get("/", getApiHealth);

healthRouter.get(
  "/database",
  asyncHandler(getDatabaseHealth)
);
