import { z } from "zod";

const identifierSchema = z
  .string()
  .trim()
  .min(
    1,
    "A player ID is required."
  )
  .max(
    64,
    "The supplied player ID is invalid."
  );

const rackLetterSchema = z
  .string()
  .trim()
  .length(
    1,
    "Every remaining tile must contain exactly one letter."
  )
  .regex(
    /^[A-Za-z]$/,
    "Every remaining tile must contain one English letter."
  )
  .transform((value) =>
    value.toUpperCase()
  );

const remainingRackTileSchema = z
  .object({
    letter:
      rackLetterSchema,

    isBlank:
      z.boolean()
  })
  .strict();

const completeMatchPlayerSchema = z
  .object({
    playerId:
      identifierSchema,

    rackTiles: z
      .array(
        remainingRackTileSchema
      )
      .max(
        7,
        "A remaining Scrabble rack cannot contain more than seven tiles."
      )
  })
  .strict();

export const completeMatchSchema = z
  .object({
    reason: z.enum([
      "PLAYER_EMPTIED_RACK",
      "STALEMATE"
    ]),

    finishingPlayerId:
      identifierSchema.optional(),

    players: z
      .array(
        completeMatchPlayerSchema
      )
      .min(
        2,
        "Completion requires at least two players."
      )
      .max(
        4,
        "Completion cannot contain more than four players."
      )
  })
  .strict()
  .superRefine(
    (
      input,
      context
    ) => {
      if (
        input.reason ===
          "PLAYER_EMPTIED_RACK" &&
        input.finishingPlayerId ===
          undefined
      ) {
        context.addIssue({
          code:
            "custom",

          path: [
            "finishingPlayerId"
          ],

          message:
            "A finishing player is required when a player emptied their rack."
        });
      }

      if (
        input.reason ===
          "STALEMATE" &&
        input.finishingPlayerId !==
          undefined
      ) {
        context.addIssue({
          code:
            "custom",

          path: [
            "finishingPlayerId"
          ],

          message:
            "A stalemate cannot include a finishing player."
        });
      }
    }
  );

export type CompleteMatchInput =
  z.infer<
    typeof completeMatchSchema
  >;
