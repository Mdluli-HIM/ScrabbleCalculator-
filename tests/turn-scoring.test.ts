import {
  describe,
  expect,
  it
} from "vitest";

import {
  calculateTurnScore,
  getEnglishTileValue
} from "../src/modules/turns/turn-scoring.js";

import {
  TurnScoringError
} from "../src/modules/turns/turn-scoring.types.js";

import type {
  TurnScoringErrorCode
} from "../src/modules/turns/turn-scoring.types.js";

function expectScoringError(
  action: () => unknown,
  expectedCode:
    TurnScoringErrorCode
): void {
  try {
    action();

    throw new Error(
      "Expected scoring to fail."
    );
  } catch (error: unknown) {
    expect(
      error
    ).toBeInstanceOf(
      TurnScoringError
    );

    expect(
      (
        error as
          TurnScoringError
      ).code
    ).toBe(expectedCode);
  }
}

describe(
  "Scrabble turn scoring engine",
  () => {
    it("uses standard English Scrabble tile values", () => {
      expect(
        getEnglishTileValue("A")
      ).toBe(1);

      expect(
        getEnglishTileValue("D")
      ).toBe(2);

      expect(
        getEnglishTileValue("B")
      ).toBe(3);

      expect(
        getEnglishTileValue("F")
      ).toBe(4);

      expect(
        getEnglishTileValue("K")
      ).toBe(5);

      expect(
        getEnglishTileValue("J")
      ).toBe(8);

      expect(
        getEnglishTileValue("Q")
      ).toBe(10);
    });

    it("scores a normal word without premiums", () => {
      const result =
        calculateTurnScore({
          placedTiles: [
            {
              id: "c",
              letter: "C",
              isBlank: false,
              premium: "NONE"
            },
            {
              id: "a",
              letter: "A",
              isBlank: false,
              premium: "NONE"
            },
            {
              id: "t",
              letter: "T",
              isBlank: false,
              premium: "NONE"
            }
          ],
          words: [
            {
              tiles: [
                {
                  source: "PLACED",
                  placedTileId: "c"
                },
                {
                  source: "PLACED",
                  placedTileId: "a"
                },
                {
                  source: "PLACED",
                  placedTileId: "t"
                }
              ]
            }
          ]
        });

      expect(result).toMatchObject({
        placedTileCount: 3,
        replacementTileCount: 3,
        wordPoints: 5,
        bingoBonus: 0,
        totalPoints: 5
      });

      expect(result.words).toEqual([
        {
          word: "CAT",
          letterPoints: 5,
          wordMultiplier: 1,
          points: 5
        }
      ]);
    });

    it("applies letter premiums only to placed tiles and keeps blanks worth zero", () => {
      const result =
        calculateTurnScore({
          placedTiles: [
            {
              id: "q",
              letter: "Q",
              isBlank: false,
              premium:
                "DOUBLE_LETTER"
            },
            {
              id: "i",
              letter: "I",
              isBlank: true,
              premium:
                "TRIPLE_LETTER"
            }
          ],
          words: [
            {
              tiles: [
                {
                  source: "PLACED",
                  placedTileId: "q"
                },
                {
                  source: "EXISTING",
                  letter: "U",
                  isBlank: false
                },
                {
                  source: "PLACED",
                  placedTileId: "i"
                },
                {
                  source: "EXISTING",
                  letter: "Z",
                  isBlank: false
                }
              ]
            }
          ]
        });

      expect(result.words).toEqual([
        {
          word: "QUIZ",
          letterPoints: 31,
          wordMultiplier: 1,
          points: 31
        }
      ]);

      expect(result.totalPoints).toBe(31);
    });

    it("multiplies multiple word premiums", () => {
      const result =
        calculateTurnScore({
          placedTiles: [
            {
              id: "c",
              letter: "C",
              isBlank: false,
              premium: "DOUBLE_WORD"
            },
            {
              id: "a",
              letter: "A",
              isBlank: false,
              premium: "TRIPLE_WORD"
            },
            {
              id: "t",
              letter: "T",
              isBlank: false,
              premium: "NONE"
            }
          ],
          words: [
            {
              tiles: [
                {
                  source: "PLACED",
                  placedTileId: "c"
                },
                {
                  source: "PLACED",
                  placedTileId: "a"
                },
                {
                  source: "PLACED",
                  placedTileId: "t"
                }
              ]
            }
          ]
        });

      expect(result.words).toEqual([
        {
          word: "CAT",
          letterPoints: 5,
          wordMultiplier: 6,
          points: 30
        }
      ]);
    });

    it("scores multiple formed words and allows a shared placed intersection tile", () => {
      const result =
        calculateTurnScore({
          placedTiles: [
            {
              id: "shared-s",
              letter: "S",
              isBlank: false,
              premium:
                "DOUBLE_LETTER"
            }
          ],
          words: [
            {
              tiles: [
                {
                  source: "EXISTING",
                  letter: "C",
                  isBlank: false
                },
                {
                  source: "EXISTING",
                  letter: "A",
                  isBlank: false
                },
                {
                  source: "EXISTING",
                  letter: "T",
                  isBlank: false
                },
                {
                  source: "PLACED",
                  placedTileId:
                    "shared-s"
                }
              ]
            },
            {
              tiles: [
                {
                  source: "EXISTING",
                  letter: "A",
                  isBlank: false
                },
                {
                  source: "PLACED",
                  placedTileId:
                    "shared-s"
                }
              ]
            }
          ]
        });

      expect(result.words).toEqual([
        {
          word: "CATS",
          letterPoints: 7,
          wordMultiplier: 1,
          points: 7
        },
        {
          word: "AS",
          letterPoints: 3,
          wordMultiplier: 1,
          points: 3
        }
      ]);

      expect(result.totalPoints).toBe(10);
      expect(
        result.replacementTileCount
      ).toBe(1);
    });

    it("adds the 50-point bingo bonus when seven tiles are placed", () => {
      const letters = [
        "R",
        "E",
        "A",
        "D",
        "I",
        "N",
        "G"
      ];

      const result =
        calculateTurnScore({
          placedTiles:
            letters.map(
              (
                letter,
                index
              ) => ({
                id: `tile-${index}`,
                letter,
                isBlank: false,
                premium: "NONE"
              })
            ),
          words: [
            {
              tiles:
                letters.map(
                  (
                    _letter,
                    index
                  ) => ({
                    source:
                      "PLACED" as const,
                    placedTileId:
                      `tile-${index}`
                  })
                )
            }
          ]
        });

      expect(result).toMatchObject({
        placedTileCount: 7,
        replacementTileCount: 7,
        wordPoints: 9,
        bingoBonus: 50,
        totalPoints: 59
      });
    });

    it("rejects duplicate placed tile IDs", () => {
      expectScoringError(
        () =>
          calculateTurnScore({
            placedTiles: [
              {
                id: "same",
                letter: "A",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "same",
                letter: "T",
                isBlank: false,
                premium: "NONE"
              }
            ],
            words: [
              {
                tiles: [
                  {
                    source:
                      "PLACED",
                    placedTileId:
                      "same"
                  }
                ]
              }
            ]
          }),
        "DUPLICATE_PLACED_TILE_ID"
      );
    });

    it("rejects a word that does not use a newly placed tile", () => {
      expectScoringError(
        () =>
          calculateTurnScore({
            placedTiles: [
              {
                id: "n",
                letter: "N",
                isBlank: false,
                premium: "NONE"
              }
            ],
            words: [
              {
                tiles: [
                  {
                    source:
                      "EXISTING",
                    letter: "A",
                    isBlank: false
                  },
                  {
                    source:
                      "EXISTING",
                    letter: "T",
                    isBlank: false
                  }
                ]
              }
            ]
          }),
        "WORD_MUST_USE_PLACED_TILE"
      );
    });

    it("rejects placed tiles that are not used by any formed word", () => {
      expectScoringError(
        () =>
          calculateTurnScore({
            placedTiles: [
              {
                id: "a",
                letter: "A",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "unused",
                letter: "Z",
                isBlank: false,
                premium: "NONE"
              }
            ],
            words: [
              {
                tiles: [
                  {
                    source:
                      "PLACED",
                    placedTileId: "a"
                  }
                ]
              }
            ]
          }),
        "UNUSED_PLACED_TILE"
      );
    });
  }
);
