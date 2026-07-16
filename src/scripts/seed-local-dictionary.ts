import {
  readFile
} from "node:fs/promises";

import {
  resolve
} from "node:path";

import {
  prisma
} from "../lib/database.js";

const LEXICON_CODE =
  "LOCAL_STARTER";

const LEXICON_VERSION =
  "1.0.0";

const LEXICON_NAME =
  "ScrabbleCalculator Local Starter Lexicon";

const LEXICON_DESCRIPTION =
  "A small local development lexicon. It is not an official Oxford or tournament dictionary.";

const dictionaryFile = resolve(
  process.cwd(),
  "data/dictionaries/local-starter-v1.txt"
);

function parseWords(
  content: string
): string[] {
  const words =
    new Set<string>();

  for (
    const rawLine of content.split(
      /\r?\n/
    )
  ) {
    const line =
      rawLine.trim();

    if (
      line.length === 0 ||
      line.startsWith("#")
    ) {
      continue;
    }

    const word =
      line.toUpperCase();

    if (!/^[A-Z]+$/.test(word)) {
      throw new Error(
        `Invalid dictionary entry: ${rawLine}`
      );
    }

    if (word.length > 40) {
      throw new Error(
        `Dictionary entry is too long: ${word}`
      );
    }

    words.add(word);
  }

  if (words.size === 0) {
    throw new Error(
      "The local dictionary contains no words."
    );
  }

  return [...words].sort();
}

function wordListsMatch(
  first: string[],
  second: string[]
): boolean {
  return (
    first.length ===
      second.length &&
    first.every(
      (
        word,
        index
      ) =>
        word ===
        second[index]
    )
  );
}

async function seedLocalDictionary():
  Promise<void> {
  const content =
    await readFile(
      dictionaryFile,
      "utf8"
    );

  const words =
    parseWords(content);

  const lexicon =
    await prisma.$transaction(
      async (transaction) => {
        const existing =
          await transaction
            .dictionaryLexicon
            .findUnique({
              where: {
                code_version: {
                  code:
                    LEXICON_CODE,
                  version:
                    LEXICON_VERSION
                }
              },
              include: {
                words: {
                  select: {
                    word: true
                  },
                  orderBy: {
                    word: "asc"
                  }
                }
              }
            });

        if (existing) {
          const existingWords =
            existing.words.map(
              (entry) =>
                entry.word
            );

          if (
            !wordListsMatch(
              existingWords,
              words
            )
          ) {
            throw new Error(
              [
                `Dictionary ${LEXICON_CODE} version ${LEXICON_VERSION} already exists with different contents.`,
                "Dictionary versions are immutable.",
                "Create a new dictionary version instead of modifying this file in place."
              ].join(" ")
            );
          }

          await transaction
            .dictionaryLexicon
            .updateMany({
              where: {
                code:
                  LEXICON_CODE,
                isCurrent: true,
                id: {
                  not:
                    existing.id
                }
              },
              data: {
                isCurrent: false
              }
            });

          return transaction
            .dictionaryLexicon
            .update({
              where: {
                id: existing.id
              },
              data: {
                name:
                  LEXICON_NAME,
                description:
                  LEXICON_DESCRIPTION,
                isCurrent: true
              }
            });
        }

        await transaction
          .dictionaryLexicon
          .updateMany({
            where: {
              code:
                LEXICON_CODE,
              isCurrent: true
            },
            data: {
              isCurrent: false
            }
          });

        const created =
          await transaction
            .dictionaryLexicon
            .create({
              data: {
                code:
                  LEXICON_CODE,
                version:
                  LEXICON_VERSION,
                name:
                  LEXICON_NAME,
                description:
                  LEXICON_DESCRIPTION,
                isCurrent: true
              }
            });

        await transaction
          .dictionaryWord
          .createMany({
            data: words.map(
              (word) => ({
                lexiconId:
                  created.id,
                word
              })
            )
          });

        return created;
      }
    );

  console.log(
    [
      "Local dictionary ready.",
      `Code: ${lexicon.code}`,
      `Version: ${lexicon.version}`,
      `Words: ${words.length}`
    ].join("\n")
  );
}

seedLocalDictionary()
  .catch((error: unknown) => {
    console.error(
      "Local dictionary seeding failed."
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
