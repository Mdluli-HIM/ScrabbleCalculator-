import {
  describe,
  expect,
  it
} from "vitest";

import {
  calculateEndGameResults
} from "../src/modules/end-game/end-game-engine.js";

import {
  EndGameScoringError
} from "../src/modules/end-game/end-game.types.js";

import type {
  EndGamePlayerInput,
  EndGameRackTileInput,
  EndGameScoringErrorCode
} from "../src/modules/end-game/end-game.types.js";

function tile(
  letter: string,
  isBlank = false
): EndGameRackTileInput {
  return {
    letter,
    isBlank
  };
}

function player(
  input: {
    playerId: string;
    displayName?: string;
    turnOrder: number;
    totalPoints: number;
    rackTiles?:
      EndGameRackTileInput[];
  }
): EndGamePlayerInput {
  return {
    playerId:
      input.playerId,

    displayName:
      input.displayName ??
      input.playerId,

    turnOrder:
      input.turnOrder,

    totalPoints:
      input.totalPoints,

    rackTiles:
      input.rackTiles ?? []
  };
}

function expectEndGameError(
  action: () => unknown,
  code:
    EndGameScoringErrorCode
): void {
  try {
    action();

    throw new Error(
      "Expected end-game scoring to fail."
    );
  } catch (error: unknown) {
    expect(
      error
    ).toBeInstanceOf(
      EndGameScoringError
    );

    expect(
      (
        error as
          EndGameScoringError
      ).code
    ).toBe(code);
  }
}

describe(
  "Scrabble end-game scoring engine",
  () => {
    it(
      "scores remaining rack letters and keeps blank tiles worth zero",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "STALEMATE",

            players: [
              player({
                playerId:
                  "player-one",
                turnOrder: 1,
                totalPoints: 20,
                rackTiles: [
                  tile("q"),
                  tile("z", true),
                  tile("A")
                ]
              }),

              player({
                playerId:
                  "player-two",
                turnOrder: 2,
                totalPoints: 20
              })
            ]
          });

        expect(
          result.standings.find(
            (standing) =>
              standing.playerId ===
              "player-one"
          )
        ).toMatchObject({
          baseScore: 20,
          rackTileCount: 3,
          rackDeduction: 11,
          finishingBonus: 0,
          finalScore: 9
        });
      }
    );

    it(
      "deducts an opponent's rack and awards it to a two-player finisher",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "PLAYER_EMPTIED_RACK",

            finishingPlayerId:
              "finisher",

            players: [
              player({
                playerId:
                  "finisher",
                displayName:
                  "Finisher",
                turnOrder: 1,
                totalPoints: 100
              }),

              player({
                playerId:
                  "opponent",
                displayName:
                  "Opponent",
                turnOrder: 2,
                totalPoints: 90,
                rackTiles: [
                  tile("Q"),
                  tile("I")
                ]
              })
            ]
          });

        expect(
          result.totalRackDeduction
        ).toBe(11);

        expect(
          result.standings
        ).toEqual([
          {
            playerId:
              "finisher",
            displayName:
              "Finisher",
            turnOrder: 1,
            baseScore: 100,
            rackTileCount: 0,
            rackDeduction: 0,
            finishingBonus: 11,
            finalScore: 111,
            rank: 1,
            isWinner: true
          },
          {
            playerId:
              "opponent",
            displayName:
              "Opponent",
            turnOrder: 2,
            baseScore: 90,
            rackTileCount: 2,
            rackDeduction: 11,
            finishingBonus: 0,
            finalScore: 79,
            rank: 2,
            isWinner: false
          }
        ]);
      }
    );

    it(
      "awards a finisher every opponent's combined rack deductions",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "PLAYER_EMPTIED_RACK",

            finishingPlayerId:
              "alpha",

            players: [
              player({
                playerId: "alpha",
                turnOrder: 1,
                totalPoints: 50
              }),

              player({
                playerId: "beta",
                turnOrder: 2,
                totalPoints: 60,
                rackTiles: [
                  tile("Z")
                ]
              }),

              player({
                playerId: "gamma",
                turnOrder: 3,
                totalPoints: 55,
                rackTiles: [
                  tile("J"),
                  tile("K"),
                  tile("Q", true)
                ]
              })
            ]
          });

        expect(
          result.totalRackDeduction
        ).toBe(23);

        expect(
          result.standings.find(
            (standing) =>
              standing.playerId ===
              "alpha"
          )
        ).toMatchObject({
          finishingBonus: 23,
          finalScore: 73,
          rank: 1,
          isWinner: true
        });
      }
    );

    it(
      "applies rack deductions without a finishing bonus for a stalemate",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "STALEMATE",

            players: [
              player({
                playerId: "alpha",
                turnOrder: 1,
                totalPoints: 20,
                rackTiles: [
                  tile("Q")
                ]
              }),

              player({
                playerId: "beta",
                turnOrder: 2,
                totalPoints: 15,
                rackTiles: [
                  tile("Z")
                ]
              })
            ]
          });

        expect(
          result.finishingPlayerId
        ).toBeUndefined();

        expect(
          result.standings.map(
            (standing) => ({
              playerId:
                standing.playerId,
              finishingBonus:
                standing.finishingBonus,
              finalScore:
                standing.finalScore
            })
          )
        ).toEqual([
          {
            playerId: "alpha",
            finishingBonus: 0,
            finalScore: 10
          },
          {
            playerId: "beta",
            finishingBonus: 0,
            finalScore: 5
          }
        ]);
      }
    );

    it(
      "uses dense ranks and stable turn order for tied final scores",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "STALEMATE",

            players: [
              player({
                playerId: "alpha",
                turnOrder: 2,
                totalPoints: 50,
                rackTiles: [
                  tile("J")
                ]
              }),

              player({
                playerId: "beta",
                turnOrder: 1,
                totalPoints: 45,
                rackTiles: [
                  tile("B")
                ]
              }),

              player({
                playerId: "gamma",
                turnOrder: 3,
                totalPoints: 40,
                rackTiles: [
                  tile("A")
                ]
              })
            ]
          });

        expect(
          result.standings.map(
            (standing) => ({
              playerId:
                standing.playerId,
              finalScore:
                standing.finalScore,
              rank:
                standing.rank
            })
          )
        ).toEqual([
          {
            playerId: "beta",
            finalScore: 42,
            rank: 1
          },
          {
            playerId: "alpha",
            finalScore: 42,
            rank: 1
          },
          {
            playerId: "gamma",
            finalScore: 39,
            rank: 2
          }
        ]);

        expect(
          result.hasSharedWin
        ).toBe(true);

        expect(
          result.winners.map(
            (winner) =>
              winner.playerId
          )
        ).toEqual([
          "beta",
          "alpha"
        ]);
      }
    );

    it(
      "returns only dense ranks one through three in the podium",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "STALEMATE",

            players: [
              player({
                playerId: "one",
                turnOrder: 1,
                totalPoints: 100
              }),
              player({
                playerId: "two",
                turnOrder: 2,
                totalPoints: 90
              }),
              player({
                playerId: "three",
                turnOrder: 3,
                totalPoints: 80
              }),
              player({
                playerId: "four",
                turnOrder: 4,
                totalPoints: 70
              })
            ]
          });

        expect(
          result.podium.map(
            (standing) =>
              standing.playerId
          )
        ).toEqual([
          "one",
          "two",
          "three"
        ]);
      }
    );

    it(
      "allows a final score to become negative after rack deductions",
      () => {
        const result =
          calculateEndGameResults({
            reason:
              "STALEMATE",

            players: [
              player({
                playerId: "alpha",
                turnOrder: 1,
                totalPoints: 0,
                rackTiles: [
                  tile("Q"),
                  tile("Z")
                ]
              }),

              player({
                playerId: "beta",
                turnOrder: 2,
                totalPoints: 0
              })
            ]
          });

        expect(
          result.standings.find(
            (standing) =>
              standing.playerId ===
              "alpha"
          )?.finalScore
        ).toBe(-20);
      }
    );

    it(
      "rejects fewer than two players",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              players: [
                player({
                  playerId: "only",
                  turnOrder: 1,
                  totalPoints: 0
                })
              ]
            }),
          "END_GAME_PLAYER_COUNT_INVALID"
        );
      }
    );

    it(
      "rejects duplicate player IDs",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              players: [
                player({
                  playerId: "same",
                  turnOrder: 1,
                  totalPoints: 10
                }),
                player({
                  playerId: "same",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_PLAYER_ID_DUPLICATE"
        );
      }
    );

    it(
      "rejects duplicate turn orders",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10
                }),
                player({
                  playerId: "beta",
                  turnOrder: 1,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_TURN_ORDER_DUPLICATE"
        );
      }
    );

    it(
      "rejects remaining racks larger than seven tiles",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10,
                  rackTiles:
                    Array.from(
                      {
                        length: 8
                      },
                      () =>
                        tile("A")
                    )
                }),
                player({
                  playerId: "beta",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_RACK_TOO_LARGE"
        );
      }
    );

    it(
      "rejects invalid remaining tile characters",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10,
                  rackTiles: [
                    tile("10")
                  ]
                }),
                player({
                  playerId: "beta",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_TILE_INVALID"
        );
      }
    );

    it(
      "requires a finishing player when a rack was emptied",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "PLAYER_EMPTIED_RACK",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10
                }),
                player({
                  playerId: "beta",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_FINISHER_REQUIRED"
        );
      }
    );

    it(
      "rejects a finishing player whose remaining rack is not empty",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "PLAYER_EMPTIED_RACK",
              finishingPlayerId:
                "alpha",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10,
                  rackTiles: [
                    tile("A")
                  ]
                }),
                player({
                  playerId: "beta",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_FINISHER_RACK_NOT_EMPTY"
        );
      }
    );

    it(
      "rejects a finishing player for a stalemate",
      () => {
        expectEndGameError(
          () =>
            calculateEndGameResults({
              reason:
                "STALEMATE",
              finishingPlayerId:
                "alpha",
              players: [
                player({
                  playerId: "alpha",
                  turnOrder: 1,
                  totalPoints: 10
                }),
                player({
                  playerId: "beta",
                  turnOrder: 2,
                  totalPoints: 20
                })
              ]
            }),
          "END_GAME_FINISHER_NOT_ALLOWED"
        );
      }
    );
  }
);
