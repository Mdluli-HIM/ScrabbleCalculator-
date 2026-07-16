import { z } from "zod";

const submittedDictionaryWordSchema = z
  .string()
  .trim()
  .min(
    1,
    "A dictionary word cannot be empty."
  )
  .max(
    40,
    "A dictionary word cannot exceed 40 characters."
  )
  .regex(
    /^[A-Za-z]+$/,
    "Dictionary words may contain letters only."
  );

export const validateDictionaryWordsSchema =
  z
    .object({
      words: z
        .array(
          submittedDictionaryWordSchema
        )
        .min(
          1,
          "Submit at least one word for validation."
        )
        .max(
          15,
          "A maximum of 15 words can be validated at once."
        )
    })
    .strict();

export type ValidateDictionaryWordsInput =
  z.infer<
    typeof validateDictionaryWordsSchema
  >;
