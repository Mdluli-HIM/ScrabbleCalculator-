import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(1, "An ID is required.")
  .max(64, "The supplied ID is invalid.");

const clientTileIdSchema = z
  .string()
  .trim()
  .min(1, "A client tile ID is required.")
  .max(
    60,
    "A client tile ID cannot exceed 60 characters."
  );

const letterSchema = z
  .string()
  .trim()
  .length(
    1,
    "Every tile must contain exactly one letter."
  )
  .regex(
    /^[A-Za-z]$/,
    "Every tile must contain one English letter."
  )
  .transform((value) =>
    value.toUpperCase()
  );

const tilePremiumSchema = z.enum([
  "NONE",
  "DOUBLE_LETTER",
  "TRIPLE_LETTER",
  "DOUBLE_WORD",
  "TRIPLE_WORD"
]);

const placedTileSchema = z
  .object({
    id: clientTileIdSchema,
    letter: letterSchema,
    isBlank: z.boolean(),
    premium: tilePremiumSchema
  })
  .strict();

const placedWordTileSchema = z
  .object({
    source: z.literal("PLACED"),
    placedTileId:
      clientTileIdSchema
  })
  .strict();

const existingWordTileSchema = z
  .object({
    source: z.literal("EXISTING"),
    letter: letterSchema,
    isBlank: z.boolean()
  })
  .strict();

const wordTileSchema =
  z.discriminatedUnion(
    "source",
    [
      placedWordTileSchema,
      existingWordTileSchema
    ]
  );

const turnWordSchema = z
  .object({
    tiles: z
      .array(wordTileSchema)
      .min(
        1,
        "A formed word requires at least one tile."
      )
      .max(
        40,
        "A formed word cannot exceed 40 tiles."
      )
  })
  .strict();

export const submitTurnSchema = z
  .object({
    playerId: identifierSchema,

    placedTiles: z
      .array(placedTileSchema)
      .min(
        1,
        "A turn must place at least one tile."
      )
      .max(
        7,
        "A turn cannot place more than seven tiles."
      ),

    words: z
      .array(turnWordSchema)
      .min(
        1,
        "A turn must form at least one word."
      )
      .max(
        15,
        "A turn cannot submit more than 15 formed words."
      )
  })
  .strict();

export type SubmitTurnInput =
  z.infer<typeof submitTurnSchema>;
