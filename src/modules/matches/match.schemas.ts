import { z } from "zod";

import {
  normalizeDisplayName
} from "../../utils/normalization.js";

const identifierSchema = z
  .string()
  .trim()
  .min(1, "An ID is required.")
  .max(64, "The supplied ID is invalid.");

const dictionaryPolicySchema = z.enum([
  "LOCAL_WORD_LIST",
  "OXFORD_ONLY",
  "TOURNAMENT_LEXICON_ONLY",
  "BOTH_REQUIRED",
  "EITHER_ACCEPTED"
]);

const matchNameSchema = z
  .string()
  .trim()
  .min(
    2,
    "Match name must contain at least 2 characters."
  )
  .max(
    80,
    "Match name cannot exceed 80 characters."
  )
  .transform((value) =>
    value.replace(/\s+/g, " ")
  );

const playerNameSchema = z
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

export const matchParamsSchema = z
  .object({
    matchId: identifierSchema
  })
  .strict();

export const matchPlayerParamsSchema = z
  .object({
    matchId: identifierSchema,
    playerId: identifierSchema
  })
  .strict();

export const createMatchSchema = z
  .object({
    name: matchNameSchema.optional(),
    dictionaryPolicy:
      dictionaryPolicySchema
  })
  .strict();

export const updateDraftMatchSchema = z
  .object({
    name: z
      .union([
        matchNameSchema,
        z.null()
      ])
      .optional(),

    dictionaryPolicy:
      dictionaryPolicySchema.optional()
  })
  .strict()
  .refine(
    (input) =>
      input.name !== undefined ||
      input.dictionaryPolicy !== undefined,
    {
      message:
        "Supply at least one match field to update."
    }
  );

const localPlayerSchema = z
  .object({
    source: z.literal("LOCAL"),
    displayName: playerNameSchema
  })
  .strict();

const registeredPlayerSchema = z
  .object({
    source:
      z.literal("REGISTERED_USER"),

    registeredUserId:
      identifierSchema.optional()
  })
  .strict();

const guestPlayerSchema = z
  .object({
    source:
      z.literal("GUEST_PLAYER"),

    guestPlayerId: identifierSchema
  })
  .strict();

export const addMatchPlayerSchema =
  z.discriminatedUnion(
    "source",
    [
      localPlayerSchema,
      registeredPlayerSchema,
      guestPlayerSchema
    ]
  );

const orderedPlayerIdsSchema = z
  .array(identifierSchema)
  .min(
    1,
    "At least one player is required."
  )
  .max(
    4,
    "A Scrabble match supports a maximum of four players."
  )
  .refine(
    (playerIds) =>
      new Set(playerIds).size ===
      playerIds.length,
    {
      message:
        "Player IDs cannot be repeated."
    }
  );

export const reorderMatchPlayersSchema = z
  .object({
    seatOrder:
      orderedPlayerIdsSchema,

    turnOrder:
      orderedPlayerIdsSchema
  })
  .strict()
  .superRefine(
    (
      input,
      context
    ) => {
      if (
        input.seatOrder.length !==
        input.turnOrder.length
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Seat order and turn order must contain the same number of players."
        });

        return;
      }

      const seatPlayers =
        new Set(input.seatOrder);

      const samePlayers =
        input.turnOrder.every(
          (playerId) =>
            seatPlayers.has(playerId)
        );

      if (!samePlayers) {
        context.addIssue({
          code: "custom",
          message:
            "Seat order and turn order must contain the same players."
        });
      }
    }
  );

export const emptyMatchActionSchema =
  z.object({}).strict();

export type CreateMatchInput =
  z.infer<typeof createMatchSchema>;

export type UpdateDraftMatchInput =
  z.infer<typeof updateDraftMatchSchema>;

export type AddMatchPlayerInput =
  z.infer<typeof addMatchPlayerSchema>;

export type ReorderMatchPlayersInput =
  z.infer<
    typeof reorderMatchPlayersSchema
  >;
