import {
  TurnScoringError
} from "./turn-scoring.types.js";

import type {
  CalculateTurnScoreInput,
  ScoredTurnWord,
  ScoringPlacedTile,
  ScoringWordInput,
  TilePremium,
  TurnScoreResult
} from "./turn-scoring.types.js";

const ENGLISH_TILE_VALUES:
  Readonly<Record<string, number>> =
    Object.freeze({
      A: 1,
      B: 3,
      C: 3,
      D: 2,
      E: 1,
      F: 4,
      G: 2,
      H: 4,
      I: 1,
      J: 8,
      K: 5,
      L: 1,
      M: 3,
      N: 1,
      O: 1,
      P: 3,
      Q: 10,
      R: 1,
      S: 1,
      T: 1,
      U: 1,
      V: 4,
      W: 4,
      X: 8,
      Y: 4,
      Z: 10
    });

function normalizeLetter(
  value: string
): string {
  const letter =
    value.trim().toUpperCase();

  if (!/^[A-Z]$/.test(letter)) {
    throw new TurnScoringError(
      "Every tile must contain exactly one English letter.",
      "INVALID_TILE_LETTER"
    );
  }

  return letter;
}

function normalizeTileId(
  value: string
): string {
  const id = value.trim();

  if (
    id.length === 0 ||
    id.length > 64
  ) {
    throw new TurnScoringError(
      "Every placed tile must have a valid unique ID.",
      "INVALID_TILE_ID"
    );
  }

  return id;
}

export function getEnglishTileValue(
  letter: string,
  isBlank = false
): number {
  const normalizedLetter =
    normalizeLetter(letter);

  if (isBlank) {
    return 0;
  }

  return ENGLISH_TILE_VALUES[
    normalizedLetter
  ] as number;
}

function applyPlacedTilePremium(
  value: number,
  premium: TilePremium
): {
  letterPoints: number;
  wordMultiplier: number;
} {
  switch (premium) {
    case "DOUBLE_LETTER":
      return {
        letterPoints: value * 2,
        wordMultiplier: 1
      };

    case "TRIPLE_LETTER":
      return {
        letterPoints: value * 3,
        wordMultiplier: 1
      };

    case "DOUBLE_WORD":
      return {
        letterPoints: value,
        wordMultiplier: 2
      };

    case "TRIPLE_WORD":
      return {
        letterPoints: value,
        wordMultiplier: 3
      };

    case "NONE":
      return {
        letterPoints: value,
        wordMultiplier: 1
      };
  }
}

function indexPlacedTiles(
  placedTiles: ScoringPlacedTile[]
): Map<string, ScoringPlacedTile> {
  if (
    placedTiles.length < 1 ||
    placedTiles.length > 7
  ) {
    throw new TurnScoringError(
      "A scoring turn must place between one and seven tiles.",
      "INVALID_PLACED_TILE_COUNT"
    );
  }

  const indexedTiles =
    new Map<
      string,
      ScoringPlacedTile
    >();

  for (
    const placedTile of placedTiles
  ) {
    const id =
      normalizeTileId(
        placedTile.id
      );

    if (indexedTiles.has(id)) {
      throw new TurnScoringError(
        "Placed tile IDs cannot be repeated.",
        "DUPLICATE_PLACED_TILE_ID"
      );
    }

    indexedTiles.set(
      id,
      {
        ...placedTile,
        id,
        letter:
          normalizeLetter(
            placedTile.letter
          )
      }
    );
  }

  return indexedTiles;
}

function scoreWord(
  input: ScoringWordInput,
  placedTiles:
    ReadonlyMap<
      string,
      ScoringPlacedTile
    >,
  usedPlacedTileIds: Set<string>
): ScoredTurnWord {
  if (input.tiles.length === 0) {
    throw new TurnScoringError(
      "A formed word must contain at least one tile.",
      "TURN_WORD_EMPTY"
    );
  }

  const letters: string[] = [];
  const wordPlacedTileIds =
    new Set<string>();

  let letterPoints = 0;
  let wordMultiplier = 1;

  for (
    const wordTile of input.tiles
  ) {
    if (
      wordTile.source ===
      "EXISTING"
    ) {
      const letter =
        normalizeLetter(
          wordTile.letter
        );

      letters.push(letter);

      letterPoints +=
        getEnglishTileValue(
          letter,
          wordTile.isBlank
        );

      continue;
    }

    const placedTileId =
      normalizeTileId(
        wordTile.placedTileId
      );

    if (
      wordPlacedTileIds.has(
        placedTileId
      )
    ) {
      throw new TurnScoringError(
        "A placed tile cannot appear more than once in the same word.",
        "DUPLICATE_PLACED_TILE_REFERENCE"
      );
    }

    const placedTile =
      placedTiles.get(
        placedTileId
      );

    if (!placedTile) {
      throw new TurnScoringError(
        "A formed word references a tile that was not placed in this turn.",
        "UNKNOWN_PLACED_TILE"
      );
    }

    wordPlacedTileIds.add(
      placedTileId
    );

    usedPlacedTileIds.add(
      placedTileId
    );

    letters.push(
      placedTile.letter
    );

    const premiumResult =
      applyPlacedTilePremium(
        getEnglishTileValue(
          placedTile.letter,
          placedTile.isBlank
        ),
        placedTile.premium
      );

    letterPoints +=
      premiumResult.letterPoints;

    wordMultiplier *=
      premiumResult.wordMultiplier;
  }

  if (
    wordPlacedTileIds.size === 0
  ) {
    throw new TurnScoringError(
      "Every formed word must include at least one tile placed during this turn.",
      "WORD_MUST_USE_PLACED_TILE"
    );
  }

  return {
    word: letters.join(""),
    letterPoints,
    wordMultiplier,
    points:
      letterPoints *
      wordMultiplier
  };
}

export function calculateTurnScore(
  input: CalculateTurnScoreInput
): TurnScoreResult {
  if (input.words.length === 0) {
    throw new TurnScoringError(
      "Submit at least one formed word.",
      "TURN_WORDS_REQUIRED"
    );
  }

  const placedTiles =
    indexPlacedTiles(
      input.placedTiles
    );

  const usedPlacedTileIds =
    new Set<string>();

  const words =
    input.words.map(
      (word) =>
        scoreWord(
          word,
          placedTiles,
          usedPlacedTileIds
        )
    );

  for (
    const placedTileId of
      placedTiles.keys()
  ) {
    if (
      !usedPlacedTileIds.has(
        placedTileId
      )
    ) {
      throw new TurnScoringError(
        "Every placed tile must be used by at least one formed word.",
        "UNUSED_PLACED_TILE"
      );
    }
  }

  const wordPoints =
    words.reduce(
      (
        total,
        word
      ) =>
        total + word.points,
      0
    );

  const bingoBonus =
    placedTiles.size === 7
      ? 50
      : 0;

  return {
    placedTileCount:
      placedTiles.size,
    replacementTileCount:
      placedTiles.size,
    wordPoints,
    bingoBonus,
    totalPoints:
      wordPoints +
      bingoBonus,
    words
  };
}
