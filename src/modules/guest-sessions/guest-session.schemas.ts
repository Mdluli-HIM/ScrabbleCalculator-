import { z } from "zod";

import {
  normalizeDisplayName,
  normalizePlayerName
} from "../../utils/normalization.js";

export const createGuestPlayerSchema = z
  .object({
    displayName: z
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
      .transform(normalizeDisplayName)
  })
  .strict()
  .transform((value) => ({
    displayName: value.displayName,
    normalizedName:
      normalizePlayerName(value.displayName)
  }));

export const claimGuestSessionSchema = z
  .object({
    guestSessionToken: z
      .string()
      .trim()
      .min(
        32,
        "Guest session token is invalid."
      )
      .max(
        256,
        "Guest session token is invalid."
      )
  })
  .strict();

export type CreateGuestPlayerInput =
  z.infer<typeof createGuestPlayerSchema>;
