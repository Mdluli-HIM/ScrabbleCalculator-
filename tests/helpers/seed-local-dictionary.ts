import {
  readFile
} from "node:fs/promises";

import {
  resolve
} from "node:path";

import {
  prisma
} from "../../src/lib/database.js";

const dictionaryFile = resolve(
  process.cwd(),
  "data/dictionaries/local-starter-v1.txt"
);

function parseDictionaryWords(
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
        `Invalid test dictionary entry: ${rawLine}`
      );
    }

    words.add(word);
  }

  return [...words].sort();
}

export async function seedLocalTestDictionary():
  Promise<void> {
  const content =
    await readFile(
      dictionaryFile,
      "utf8"
    );

  const words =
    parseDictionaryWords(
      content
    );

  await prisma.$transaction(
    async (transaction) => {
      await transaction
        .dictionaryLexicon
        .updateMany({
          where: {
            code:
              "LOCAL_STARTER",
            isCurrent: true
          },
          data: {
            isCurrent: false
          }
        });

      const lexicon =
        await transaction
          .dictionaryLexicon
          .upsert({
            where: {
              code_version: {
                code:
                  "LOCAL_STARTER",
                version:
                  "1.0.0"
              }
            },
            create: {
              code:
                "LOCAL_STARTER",
              version:
                "1.0.0",
              name:
                "ScrabbleCalculator Local Starter Lexicon",
              description:
                "A small local development lexicon. It is not an official Oxford or tournament dictionary.",
              isCurrent: true
            },
            update: {
              name:
                "ScrabbleCalculator Local Starter Lexicon",
              description:
                "A small local development lexicon. It is not an official Oxford or tournament dictionary.",
              isCurrent: true
            }
          });

      await transaction
        .dictionaryWord
        .deleteMany({
          where: {
            lexiconId:
              lexicon.id
          }
        });

      await transaction
        .dictionaryWord
        .createMany({
          data: words.map(
            (word) => ({
              lexiconId:
                lexicon.id,
              word
            })
          )
        });
    }
  );
}
