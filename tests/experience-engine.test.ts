import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildMatchExperience
} from "../src/modules/experience/experience-engine.js";

import type {
  ExperiencePlayerInput
} from "../src/modules/experience/experience.types.js";

function player(
  playerId: string,
  turnOrder: number,
  totalPoints: number,
  recentTurnPoints:
    number[] = []
): ExperiencePlayerInput {
  return {
    playerId,
    displayName:
      playerId.toUpperCase(),
    turnOrder,
    totalPoints,
    recentTurnPoints
  };
}

describe(
  "hidden-score experience engine",
  () => {
    it(
      "returns a privacy-safe opening state",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 0,
            players: [
              player(
                "one",
                1,
                0
              ),
              player(
                "two",
                2,
                0
              )
            ]
          });

        expect(
          result
        ).toMatchObject({
          phase:
            "OPENING",
          hasSharedLead:
            true,
          closeness:
            "UNSET"
        });

        expect(
          result.leaders
        ).toHaveLength(2);

        expect(
          result.standings
        ).toEqual([
          {
            playerId:
              "one",
            displayName:
              "ONE",
            rank: 1,
            movement:
              "NEW",
            momentum:
              "NEW",
            isLeader:
              true
          },
          {
            playerId:
              "two",
            displayName:
              "TWO",
            rank: 1,
            movement:
              "NEW",
            momentum:
              "NEW",
            isLeader:
              true
          }
        ]);

        const serialized =
          JSON.stringify(
            result
          );

        expect(
          serialized
        ).not.toContain(
          "totalPoints"
        );

        expect(
          serialized
        ).not.toContain(
          "recentTurnPoints"
        );
      }
    );

    it(
      "uses dense rankings and turn order for stable ties",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 3,
            players: [
              player(
                "three",
                3,
                20
              ),
              player(
                "two",
                2,
                40
              ),
              player(
                "one",
                1,
                40
              )
            ]
          });

        expect(
          result.standings.map(
            (standing) => ({
              id:
                standing.playerId,
              rank:
                standing.rank
            })
          )
        ).toEqual([
          {
            id: "one",
            rank: 1
          },
          {
            id: "two",
            rank: 1
          },
          {
            id: "three",
            rank: 2
          }
        ]);
      }
    );

    it(
      "reports upward and downward rank movement",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 4,
            players: [
              player(
                "one",
                1,
                40
              ),
              player(
                "two",
                2,
                20
              )
            ],
            previous: {
              ranks: {
                one: 2,
                two: 1
              },
              leaderIds: [
                "two"
              ],
              momentumByPlayerId:
                {}
            }
          });

        expect(
          result.standings
            .find(
              (standing) =>
                standing.playerId ===
                "one"
            )
            ?.movement
        ).toBe("UP");

        expect(
          result.standings
            .find(
              (standing) =>
                standing.playerId ===
                "two"
            )
            ?.movement
        ).toBe("DOWN");
      }
    );

    it(
      "creates a lead-change event without exposing a score gap",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 4,
            players: [
              player(
                "one",
                1,
                42
              ),
              player(
                "two",
                2,
                30
              )
            ],
            previous: {
              ranks: {
                one: 2,
                two: 1
              },
              leaderIds: [
                "two"
              ],
              momentumByPlayerId:
                {}
            }
          });

        expect(
          result.events
        ).toContainEqual({
          type:
            "LEAD_CHANGE",
          playerId:
            "one",
          relatedPlayerId:
            "two"
        });

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          "scoreGap"
        );
      }
    );

    it(
      "creates a shared-lead event",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 4,
            players: [
              player(
                "one",
                1,
                30
              ),
              player(
                "two",
                2,
                30
              )
            ],
            previous: {
              ranks: {
                one: 1,
                two: 2
              },
              leaderIds: [
                "one"
              ],
              momentumByPlayerId:
                {}
            }
          });

        expect(
          result.hasSharedLead
        ).toBe(true);

        expect(
          result.events.some(
            (event) =>
              event.type ===
              "SHARED_LEAD"
          )
        ).toBe(true);
      }
    );

    it.each([
      {
        difference: 5,
        expected:
          "TIGHT"
      },
      {
        difference: 20,
        expected:
          "COMPETITIVE"
      },
      {
        difference: 50,
        expected:
          "OPEN"
      }
    ])(
      "classifies a $expected match",
      ({
        difference,
        expected
      }) => {
        const result =
          buildMatchExperience({
            completedTurns: 2,
            players: [
              player(
                "one",
                1,
                100
              ),
              player(
                "two",
                2,
                100 -
                  difference
              )
            ]
          });

        expect(
          result.closeness
        ).toBe(expected);
      }
    );

    it(
      "classifies momentum without returning recent scores",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 10,
            players: [
              player(
                "new",
                1,
                20,
                []
              ),
              player(
                "surging",
                2,
                30,
                [
                  5,
                  10,
                  30
                ]
              ),
              player(
                "building",
                3,
                25,
                [
                  5,
                  10,
                  16
                ]
              ),
              player(
                "steady",
                4,
                23,
                [
                  20,
                  22,
                  21
                ]
              ),
              player(
                "cooling",
                5,
                15,
                [
                  30,
                  25,
                  10
                ]
              )
            ]
          });

        const momentum =
          Object.fromEntries(
            result.standings.map(
              (standing) => [
                standing.playerId,
                standing.momentum
              ]
            )
          );

        expect(
          momentum
        ).toMatchObject({
          new:
            "NEW",
          surging:
            "SURGING",
          building:
            "BUILDING",
          steady:
            "STEADY",
          cooling:
            "COOLING"
        });

        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          "recentTurnPoints"
        );
      }
    );

    it(
      "creates comeback and momentum-shift events",
      () => {
        const result =
          buildMatchExperience({
            completedTurns: 8,
            players: [
              player(
                "one",
                1,
                80,
                [
                  5,
                  8,
                  30
                ]
              ),
              player(
                "two",
                2,
                70,
                [
                  15,
                  15,
                  15
                ]
              ),
              player(
                "three",
                3,
                60,
                [
                  10,
                  10,
                  10
                ]
              )
            ],
            previous: {
              ranks: {
                one: 3,
                two: 1,
                three: 2
              },
              leaderIds: [
                "two"
              ],
              momentumByPlayerId:
                {
                  one:
                    "STEADY"
                }
            }
          });

        expect(
          result.events
        ).toEqual(
          expect.arrayContaining([
            {
              type:
                "COMEBACK",
              playerId:
                "one"
            },
            {
              type:
                "MOMENTUM_SHIFT",
              playerId:
                "one"
            }
          ])
        );
      }
    );

    it(
      "moves from opening to active after every player has had a turn",
      () => {
        const opening =
          buildMatchExperience({
            completedTurns: 1,
            players: [
              player(
                "one",
                1,
                10
              ),
              player(
                "two",
                2,
                0
              )
            ]
          });

        const active =
          buildMatchExperience({
            completedTurns: 2,
            players: [
              player(
                "one",
                1,
                10
              ),
              player(
                "two",
                2,
                8
              )
            ]
          });

        expect(
          opening.phase
        ).toBe("OPENING");

        expect(
          active.phase
        ).toBe("ACTIVE");
      }
    );

    it(
      "rejects invalid private engine input",
      () => {
        expect(
          () =>
            buildMatchExperience({
              completedTurns: 1,
              players: [
                player(
                  "duplicate",
                  1,
                  10
                ),
                player(
                  "duplicate",
                  2,
                  20
                )
              ]
            })
        ).toThrow(
          "Player IDs must be unique."
        );

        expect(
          () =>
            buildMatchExperience({
              completedTurns: -1,
              players: []
            })
        ).toThrow(
          "completedTurns must be a non-negative integer."
        );
      }
    );
  }
);
