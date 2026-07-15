import { z } from "zod";

import {
  normalizeDisplayName
} from "../../utils/normalization.js";

const displayNameSchema = z
  .string()
  .trim()
  .min(
    2,
    "Player name must contain at least 2 characters."
  )
  .max(
    40,
    "Player name cannot exceed 40 characters."
  )
  .transform(normalizeDisplayName);

export const createGuestPlayerSchema = z
  .object({
    displayName: displayNameSchema
  })
  .strict();

export const guestPlayerParamsSchema = z
  .object({
    playerId: z
      .string()
      .trim()
      .min(1, "Player ID is required.")
      .max(64, "Player ID is invalid.")
  })
  .strict();

export type CreateGuestPlayerInput =
  z.infer<typeof createGuestPlayerSchema>;
