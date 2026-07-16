import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/database.js";

import type {
  ValidateDictionaryWordsInput
} from "./dictionary.schemas.js";

import type {
  DictionaryValidationResult,
  DictionaryWordValidation
} from "./dictionary.types.js";

import type {
  MatchActor
} from "../matches/match.types.js";

const LOCAL_LEXICON_CODE =
  "LOCAL_STARTER";

function normalizeDictionaryWord(
  word: string
): string {
  return word
    .trim()
    .toUpperCase();
}

function calculateLevenshteinDistance(
  firstWord: string,
  secondWord: string
): number {
  const previousRow =
    Array.from(
      {
        length:
          secondWord.length + 1
      },
      (
        _value,
        index
      ) => index
    );

  for (
    let firstIndex = 1;
    firstIndex <= firstWord.length;
    firstIndex += 1
  ) {
    const currentRow: number[] = [
      firstIndex
    ];

    for (
      let secondIndex = 1;
      secondIndex <=
      secondWord.length;
      secondIndex += 1
    ) {
      const insertionCost =
        currentRow[
          secondIndex - 1
        ]! + 1;

      const deletionCost =
        previousRow[
          secondIndex
        ]! + 1;

      const substitutionCost =
        previousRow[
          secondIndex - 1
        ]! +
        (
          firstWord[
            firstIndex - 1
          ] ===
          secondWord[
            secondIndex - 1
          ]
            ? 0
            : 1
        );

      currentRow.push(
        Math.min(
          insertionCost,
          deletionCost,
          substitutionCost
        )
      );
    }

    for (
      let index = 0;
      index < currentRow.length;
      index += 1
    ) {
      previousRow[index] =
        currentRow[index] as number;
    }
  }

  return previousRow[
    secondWord.length
  ] as number;
}

function createSuggestions(
  word: string,
  candidates: string[]
): string[] {
  const maximumDistance =
    word.length <= 4
      ? 2
      : 3;

  return candidates
    .map(
      (candidate) => ({
        candidate,
        distance:
          calculateLevenshteinDistance(
            word,
            candidate
          ),
        lengthDifference:
          Math.abs(
            word.length -
            candidate.length
          )
      })
    )
    .filter(
      (result) =>
        result.distance <=
        maximumDistance
    )
    .sort(
      (
        first,
        second
      ) =>
        first.distance -
          second.distance ||
        first.lengthDifference -
          second.lengthDifference ||
        first.candidate.localeCompare(
          second.candidate
        )
    )
    .slice(0, 5)
    .map(
      (result) =>
        result.candidate
    );
}

function createOwnerFilter(
  actor: MatchActor
) {
  if (
    actor.type ===
    "REGISTERED_USER"
  ) {
    return {
      ownerType:
        "REGISTERED_USER" as const,
      ownerUserId:
        actor.userId
    };
  }

  return {
    ownerType:
      "GUEST_SESSION" as const,
    ownerGuestSessionId:
      actor.guestSessionId
  };
}

export async function validateDictionaryWords(
  actor: MatchActor,
  matchId: string,
  input: ValidateDictionaryWordsInput
): Promise<DictionaryValidationResult> {
  const match =
    await prisma.match.findFirst({
      where: {
        id: matchId,
        ...createOwnerFilter(actor)
      },
      include: {
        dictionaryLexicon: true
      }
    });

  if (!match) {
    throw new AppError(
      "The requested match could not be found.",
      404,
      "MATCH_NOT_FOUND"
    );
  }

  if (
    match.status !==
    "IN_PROGRESS"
  ) {
    throw new AppError(
      "Dictionary validation is only available while a match is in progress.",
      409,
      "MATCH_NOT_IN_PROGRESS"
    );
  }

  if (
    match.dictionaryPolicy !==
    "LOCAL_WORD_LIST"
  ) {
    throw new AppError(
      "The selected dictionary policy is not available without an external provider.",
      409,
      "DICTIONARY_POLICY_NOT_AVAILABLE"
    );
  }

  if (
    !match.dictionaryLexiconId ||
    !match.dictionaryLexicon
  ) {
    throw new AppError(
      "The local dictionary version for this match is unavailable.",
      503,
      "LOCAL_DICTIONARY_UNAVAILABLE"
    );
  }

  if (
    match.dictionaryLexicon.code !==
    LOCAL_LEXICON_CODE
  ) {
    throw new AppError(
      "The match is connected to an unsupported local dictionary.",
      503,
      "LOCAL_DICTIONARY_UNAVAILABLE"
    );
  }

  const normalizedWords =
    input.words.map(
      normalizeDictionaryWord
    );

  const uniqueWords = [
    ...new Set(
      normalizedWords
    )
  ];

  const existingWords =
    await prisma.dictionaryWord.findMany({
      where: {
        lexiconId:
          match.dictionaryLexiconId,
        word: {
          in: uniqueWords
        }
      },
      select: {
        word: true
      }
    });

  const acceptedWords =
    new Set(
      existingWords.map(
        (entry) =>
          entry.word
      )
    );

  const rejectedWords =
    uniqueWords.filter(
      (word) =>
        !acceptedWords.has(word)
    );

  const suggestionCandidates =
    rejectedWords.length > 0
      ? await prisma.dictionaryWord.findMany({
          where: {
            lexiconId:
              match.dictionaryLexiconId
          },
          select: {
            word: true
          },
          orderBy: {
            word: "asc"
          },
          take: 2000
        })
      : [];

  const candidateWords =
    suggestionCandidates.map(
      (entry) =>
        entry.word
    );

  const words:
    DictionaryWordValidation[] =
      input.words.map(
        (
          submittedWord,
          index
        ) => {
          const normalizedWord =
            normalizedWords[
              index
            ] as string;

          const accepted =
            acceptedWords.has(
              normalizedWord
            );

          return {
            submittedWord:
              submittedWord.trim(),
            normalizedWord,
            accepted,
            suggestions:
              accepted
                ? []
                : createSuggestions(
                    normalizedWord,
                    candidateWords
                  )
          };
        }
      );

  return {
    matchId: match.id,
    dictionaryPolicy:
      "LOCAL_WORD_LIST",
    lexicon: {
      code:
        match.dictionaryLexicon.code,
      version:
        match.dictionaryLexicon.version,
      name:
        match.dictionaryLexicon.name
    },
    accepted:
      words.every(
        (word) =>
          word.accepted
      ),
    words
  };
}
