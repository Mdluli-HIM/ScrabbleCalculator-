import request from "supertest";

import {
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import {
  app
} from "../src/app.js";

import {
  prisma
} from "../src/lib/database.js";

import {
  resetDatabase
} from "./helpers/reset-database.js";

import {
  seedLocalTestDictionary
} from "./helpers/seed-local-dictionary.js";

const guestHeader =
  "x-guest-session-token";

interface MatchSetup {
  accessToken?: string;
  guestSessionToken?: string;
  matchId: string;
  firstPlayerId: string;
  secondPlayerId: string;
}

interface CompletionStanding {
  playerId: string;
  baseScore: number;
  rackDeduction: number;
  finishingBonus: number;
  finalScore: number;
  rank: number;
  isWinner: boolean;

  remainingRack: {
    letter: string;
    isBlank: boolean;
    value: number;
  }[];
}

async function registerUser(
  email: string
): Promise<string> {
  const response =
    await request(app)
      .post(
        "/api/v1/auth/register"
      )
      .send({
        email,
        displayName:
          "End Game Owner",
        password:
          "SecurePassword123"
      });

  expect(
    response.status
  ).toBe(201);

  return response.body.data
    .tokens.accessToken;
}

async function createRegisteredMatch(
  start = true,
  email =
    "end-game-owner@example.com"
): Promise<MatchSetup> {
  const accessToken =
    await registerUser(email);

  const created =
    await request(app)
      .post(
        "/api/v1/matches"
      )
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        name:
          "End Game Match",
        dictionaryPolicy:
          "LOCAL_WORD_LIST"
      });

  expect(
    created.status
  ).toBe(201);

  const matchId =
    created.body.data.match.id;

  const registered =
    await request(app)
      .post(
        `/api/v1/matches/${matchId}/players`
      )
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        source:
          "REGISTERED_USER"
      });

  expect(
    registered.status
  ).toBe(201);

  const local =
    await request(app)
      .post(
        `/api/v1/matches/${matchId}/players`
      )
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        source:
          "LOCAL",

        displayName:
          "Local Opponent"
      });

  expect(
    local.status
  ).toBe(201);

  const players =
    local.body.data.match.players;

  const firstPlayer =
    players.find(
      (
        player: {
          turnOrder: number;
        }
      ) =>
        player.turnOrder === 1
    );

  const secondPlayer =
    players.find(
      (
        player: {
          turnOrder: number;
        }
      ) =>
        player.turnOrder === 2
    );

  expect(
    firstPlayer
  ).toBeDefined();

  expect(
    secondPlayer
  ).toBeDefined();

  if (start) {
    const started =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/start`
        )
        .set(
          "Authorization",
          `Bearer ${accessToken}`
        )
        .send({});

    expect(
      started.status
    ).toBe(200);
  }

  return {
    accessToken,
    matchId,

    firstPlayerId:
      firstPlayer.id,

    secondPlayerId:
      secondPlayer.id
  };
}

async function createGuestMatch():
  Promise<MatchSetup> {
  const session =
    await request(app)
      .post(
        "/api/v1/guest/sessions"
      )
      .send({});

  expect(
    session.status
  ).toBe(201);

  const guestSessionToken =
    session.body.data
      .guestSessionToken;

  const guestPlayerIds:
    string[] = [];

  for (
    const displayName of [
      "Guest One",
      "Guest Two"
    ]
  ) {
    const player =
      await request(app)
        .post(
          "/api/v1/guest/players"
        )
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({
          displayName
        });

    expect(
      player.status
    ).toBe(201);

    guestPlayerIds.push(
      player.body.data.player.id
    );
  }

  const created =
    await request(app)
      .post(
        "/api/v1/matches"
      )
      .set(
        guestHeader,
        guestSessionToken
      )
      .send({
        name:
          "Guest End Game",
        dictionaryPolicy:
          "LOCAL_WORD_LIST"
      });

  expect(
    created.status
  ).toBe(201);

  const matchId =
    created.body.data.match.id;

  let currentMatch =
    created.body.data.match;

  for (
    const guestPlayerId of
    guestPlayerIds
  ) {
    const added =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/players`
        )
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({
          source:
            "GUEST_PLAYER",

          guestPlayerId
        });

    expect(
      added.status
    ).toBe(201);

    currentMatch =
      added.body.data.match;
  }

  const firstPlayer =
    currentMatch.players.find(
      (
        player: {
          turnOrder: number;
        }
      ) =>
        player.turnOrder === 1
    );

  const secondPlayer =
    currentMatch.players.find(
      (
        player: {
          turnOrder: number;
        }
      ) =>
        player.turnOrder === 2
    );

  expect(
    firstPlayer
  ).toBeDefined();

  expect(
    secondPlayer
  ).toBeDefined();

  const started =
    await request(app)
      .post(
        `/api/v1/matches/${matchId}/start`
      )
      .set(
        guestHeader,
        guestSessionToken
      )
      .send({});

  expect(
    started.status
  ).toBe(200);

  return {
    guestSessionToken,
    matchId,

    firstPlayerId:
      firstPlayer.id,

    secondPlayerId:
      secondPlayer.id
  };
}

function createTurnBody(
  playerId: string,
  word: string,
  prefix: string
) {
  const placedTiles =
    [...word].map(
      (
        letter,
        index
      ) => ({
        id:
          `${prefix}-${index + 1}`,

        letter,
        isBlank: false,
        premium:
          "NONE"
      })
    );

  return {
    playerId,
    placedTiles,

    words: [
      {
        tiles:
          placedTiles.map(
            (tile) => ({
              source:
                "PLACED",

              placedTileId:
                tile.id
            })
          )
      }
    ]
  };
}

function playerCompletion(
  playerId: string,
  rackTiles: {
    letter: string;
    isBlank: boolean;
  }[] = []
) {
  return {
    playerId,
    rackTiles
  };
}

beforeEach(async () => {
  await resetDatabase();
  await seedLocalTestDictionary();
});

describe(
  "Match completion",
  () => {
    it(
      "completes a registered match and reveals exact final scores",
      async () => {
        const setup =
          await createRegisteredMatch();

        const firstTurn =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/turns`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .set(
              "Idempotency-Key",
              "end-game-turn-001"
            )
            .send(
              createTurnBody(
                setup.firstPlayerId,
                "HELLO",
                "hello"
              )
            );

        expect(
          firstTurn.status
        ).toBe(201);

        const secondTurn =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/turns`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .set(
              "Idempotency-Key",
              "end-game-turn-002"
            )
            .send(
              createTurnBody(
                setup.secondPlayerId,
                "WORLD",
                "world"
              )
            );

        expect(
          secondTurn.status
        ).toBe(201);

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "PLAYER_EMPTIED_RACK",

              finishingPlayerId:
                setup.firstPlayerId,

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),

                playerCompletion(
                  setup.secondPlayerId,
                  [
                    {
                      letter: "Q",
                      isBlank: false
                    },
                    {
                      letter: "I",
                      isBlank: false
                    }
                  ]
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        const result =
          completed.body.data.result;

        expect(
          result
        ).toMatchObject({
          matchId:
            setup.matchId,

          status:
            "COMPLETED",

          reason:
            "PLAYER_EMPTIED_RACK",

          finishingPlayerId:
            setup.firstPlayerId,

          totalRackDeduction:
            11,

          hasSharedWin:
            false
        });

        expect(
          result.completedAt
        ).toEqual(
          expect.any(String)
        );

        const standings =
          result.standings as
            CompletionStanding[];

        expect(
          standings
        ).toEqual([
          expect.objectContaining({
            playerId:
              setup.firstPlayerId,

            baseScore: 8,
            rackDeduction: 0,
            finishingBonus: 11,
            finalScore: 19,
            rank: 1,
            isWinner: true,
            remainingRack: []
          }),

          expect.objectContaining({
            playerId:
              setup.secondPlayerId,

            baseScore: 9,
            rackDeduction: 11,
            finishingBonus: 0,
            finalScore: -2,
            rank: 2,
            isWinner: false,

            remainingRack: [
              {
                letter: "Q",
                isBlank: false,
                value: 10
              },
              {
                letter: "I",
                isBlank: false,
                value: 1
              }
            ]
          })
        ]);

        expect(
          result.winners
        ).toEqual([
          expect.objectContaining({
            playerId:
              setup.firstPlayerId
          })
        ]);

        const storedMatch =
          await prisma.match.findUnique({
            where: {
              id:
                setup.matchId
            }
          });

        expect(
          storedMatch
        ).toMatchObject({
          status:
            "COMPLETED",

          currentTurnOrder:
            null
        });

        expect(
          storedMatch?.completedAt
        ).not.toBeNull();

        const storedResult =
          await prisma.matchResult.findUnique({
            where: {
              matchId:
                setup.matchId
            },

            include: {
              playerResults: {
                include: {
                  remainingRack:
                    true
                }
              }
            }
          });

        expect(
          storedResult
            ?.playerResults
        ).toHaveLength(2);

        expect(
          storedResult
            ?.playerResults
            .flatMap(
              (entry) =>
                entry.remainingRack
            )
        ).toHaveLength(2);
      }
    );

    it(
      "completes a guest match after a stalemate",
      async () => {
        const setup =
          await createGuestMatch();

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              guestHeader,
              setup.guestSessionToken ??
                ""
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId,
                  [
                    {
                      letter: "A",
                      isBlank: false
                    }
                  ]
                ),

                playerCompletion(
                  setup.secondPlayerId,
                  [
                    {
                      letter: "B",
                      isBlank: false
                    }
                  ]
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        const result =
          completed.body.data.result;

        expect(
          result
        ).toMatchObject({
          status:
            "COMPLETED",

          reason:
            "STALEMATE",

          finishingPlayerId:
            null,

          totalRackDeduction:
            4
        });

        expect(
          result.standings
        ).toEqual([
          expect.objectContaining({
            playerId:
              setup.firstPlayerId,

            finalScore: -1,
            rank: 1,
            isWinner: true
          }),

          expect.objectContaining({
            playerId:
              setup.secondPlayerId,

            finalScore: -3,
            rank: 2,
            isWinner: false
          })
        ]);
      }
    );

    it(
      "requires a registered or guest actor",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/v1/matches/unknown/complete"
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  "one"
                ),
                playerCompletion(
                  "two"
                )
              ]
            });

        expect(
          response.status
        ).toBe(401);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_ACTOR_REQUIRED"
        );
      }
    );

    it(
      "does not reveal another owner's match",
      async () => {
        const setup =
          await createRegisteredMatch();

        const otherToken =
          await registerUser(
            "other-end-game-owner@example.com"
          );

        const response =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${otherToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),
                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          response.status
        ).toBe(404);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_NOT_FOUND"
        );
      }
    );

    it(
      "rejects completion of a draft match",
      async () => {
        const setup =
          await createRegisteredMatch(
            false
          );

        const response =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),
                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          response.status
        ).toBe(409);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_NOT_COMPLETABLE"
        );
      }
    );

    it(
      "requires every match player exactly once",
      async () => {
        const setup =
          await createRegisteredMatch();

        const response =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),

                playerCompletion(
                  "unknown-player"
                )
              ]
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.error.code
        ).toBe(
          "END_GAME_PLAYER_ROSTER_INVALID"
        );
      }
    );

    it(
      "rejects a finisher whose remaining rack is not empty",
      async () => {
        const setup =
          await createRegisteredMatch();

        const response =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "PLAYER_EMPTIED_RACK",

              finishingPlayerId:
                setup.firstPlayerId,

              players: [
                playerCompletion(
                  setup.firstPlayerId,
                  [
                    {
                      letter: "A",
                      isBlank: false
                    }
                  ]
                ),

                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          response.body.error.code
        ).toBe(
          "END_GAME_FINISHER_RACK_NOT_EMPTY"
        );
      }
    );

    it(
      "rejects repeated match completion",
      async () => {
        const setup =
          await createRegisteredMatch();

        const body = {
          reason:
            "STALEMATE",

          players: [
            playerCompletion(
              setup.firstPlayerId
            ),
            playerCompletion(
              setup.secondPlayerId
            )
          ]
        };

        const first =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send(body);

        expect(
          first.status
        ).toBe(200);

        const repeated =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send(body);

        expect(
          repeated.status
        ).toBe(409);

        expect(
          repeated.body.error.code
        ).toBe(
          "MATCH_ALREADY_COMPLETED"
        );

        expect(
          await prisma.matchResult.count({
            where: {
              matchId:
                setup.matchId
            }
          })
        ).toBe(1);
      }
    );

    it(
      "rolls back the match transition when final-result storage conflicts",
      async () => {
        const setup =
          await createRegisteredMatch();

        await prisma.matchResult.create({
          data: {
            matchId:
              setup.matchId,

            reason:
              "STALEMATE",

            finishingPlayerId:
              null,

            totalRackDeduction:
              0,

            hasSharedWin:
              false
          }
        });

        const response =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),
                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          response.status
        ).toBe(409);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_COMPLETION_CONFLICT"
        );

        const match =
          await prisma.match.findUnique({
            where: {
              id:
                setup.matchId
            }
          });

        expect(
          match
        ).toMatchObject({
          status:
            "IN_PROGRESS"
        });

        expect(
          match?.completedAt
        ).toBeNull();

        expect(
          match?.currentTurnOrder
        ).toBe(1);

        expect(
          await prisma.matchPlayerResult.count()
        ).toBe(0);
      }
    );
  }
);

describe(
  "Completed match result retrieval",
  () => {
    it(
      "retrieves the immutable exact result for a registered match",
      async () => {
        const setup =
          await createRegisteredMatch();

        const completionBody = {
          reason:
            "PLAYER_EMPTIED_RACK",

          finishingPlayerId:
            setup.firstPlayerId,

          players: [
            playerCompletion(
              setup.firstPlayerId
            ),

            playerCompletion(
              setup.secondPlayerId,
              [
                {
                  letter: "B",
                  isBlank: false
                },
                {
                  letter: "A",
                  isBlank: true
                }
              ]
            )
          ]
        };

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send(
              completionBody
            );

        expect(
          completed.status
        ).toBe(200);

        const retrieved =
          await request(app)
            .get(
              `/api/v1/matches/${setup.matchId}/results`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            );

        expect(
          retrieved.status
        ).toBe(200);

        expect(
          retrieved.body.data.result
        ).toEqual(
          completed.body.data.result
        );

        expect(
          retrieved.body.data
            .result.standings
        ).toEqual([
          expect.objectContaining({
            playerId:
              setup.firstPlayerId,

            finalScore: 3,
            rank: 1,
            isWinner: true
          }),

          expect.objectContaining({
            playerId:
              setup.secondPlayerId,

            rackDeduction: 3,
            finalScore: -3,
            rank: 2,
            isWinner: false,

            remainingRack: [
              {
                letter: "B",
                isBlank: false,
                value: 3
              },
              {
                letter: "A",
                isBlank: true,
                value: 0
              }
            ]
          })
        ]);
      }
    );

    it(
      "keeps exact results unavailable while a match is active",
      async () => {
        const setup =
          await createRegisteredMatch();

        const response =
          await request(app)
            .get(
              `/api/v1/matches/${setup.matchId}/results`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            );

        expect(
          response.status
        ).toBe(409);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_RESULT_NOT_AVAILABLE"
        );

        const serializedBody =
          JSON.stringify(
            response.body
          );

        for (
          const privateField of [
            "totalPoints",
            "baseScore",
            "finalScore",
            "rackDeduction",
            "finishingBonus",
            "highestScoringTurn",
            "highestScoringWord"
          ]
        ) {
          expect(
            serializedBody
          ).not.toContain(
            privateField
          );
        }
      }
    );

    it(
      "retrieves a completed guest match result",
      async () => {
        const setup =
          await createGuestMatch();

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              guestHeader,
              setup.guestSessionToken ??
                ""
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),

                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        const retrieved =
          await request(app)
            .get(
              `/api/v1/matches/${setup.matchId}/results`
            )
            .set(
              guestHeader,
              setup.guestSessionToken ??
                ""
            );

        expect(
          retrieved.status
        ).toBe(200);

        expect(
          retrieved.body.data.result
        ).toMatchObject({
          matchId:
            setup.matchId,

          status:
            "COMPLETED",

          reason:
            "STALEMATE",

          hasSharedWin:
            true
        });

        expect(
          retrieved.body.data
            .result.winners
        ).toHaveLength(2);
      }
    );

    it(
      "does not expose final results to another match owner",
      async () => {
        const setup =
          await createRegisteredMatch();

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),
                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        const otherToken =
          await registerUser(
            "result-intruder@example.com"
          );

        const response =
          await request(app)
            .get(
              `/api/v1/matches/${setup.matchId}/results`
            )
            .set(
              "Authorization",
              `Bearer ${otherToken}`
            );

        expect(
          response.status
        ).toBe(404);

        expect(
          response.body.error.code
        ).toBe(
          "MATCH_NOT_FOUND"
        );
      }
    );
  }
);

describe(
  "Post-match highlights",
  () => {
    it(
      "derives verified highlights from stored turns, words and experience events",
      async () => {
        const setup =
          await createRegisteredMatch();

        const firstTurn =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/turns`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .set(
              "Idempotency-Key",
              "highlight-turn-001"
            )
            .send(
              createTurnBody(
                setup.firstPlayerId,
                "HELLO",
                "highlight-hello"
              )
            );

        expect(
          firstTurn.status
        ).toBe(201);

        const secondTurn =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/turns`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .set(
              "Idempotency-Key",
              "highlight-turn-002"
            )
            .send(
              createTurnBody(
                setup.secondPlayerId,
                "WORLD",
                "highlight-world"
              )
            );

        expect(
          secondTurn.status
        ).toBe(201);

        const snapshots =
          await prisma
            .matchExperienceSnapshot
            .findMany({
              where: {
                matchId:
                  setup.matchId
              },

              select: {
                id: true
              }
            });

        const storedEvents =
          await prisma
            .matchExperienceEvent
            .findMany({
              where: {
                snapshotId: {
                  in:
                    snapshots.map(
                      (snapshot) =>
                        snapshot.id
                    )
                }
              },

              select: {
                type: true
              }
            });

        const expectedEvents = {
          total:
            storedEvents.length,

          leadChanges:
            storedEvents.filter(
              (event) =>
                event.type ===
                "LEAD_CHANGE"
            ).length,

          sharedLeads:
            storedEvents.filter(
              (event) =>
                event.type ===
                "SHARED_LEAD"
            ).length,

          rankRises:
            storedEvents.filter(
              (event) =>
                event.type ===
                "RANK_RISE"
            ).length,

          comebacks:
            storedEvents.filter(
              (event) =>
                event.type ===
                "COMEBACK"
            ).length,

          momentumShifts:
            storedEvents.filter(
              (event) =>
                event.type ===
                "MOMENTUM_SHIFT"
            ).length
        };

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),

                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        const highlights =
          completed.body.data
            .result.highlights;

        expect(
          highlights
        ).toEqual({
          totalTurns: 2,
          totalWords: 2,
          bingoCount: 0,

          highestScoringTurn: {
            turnNumber: 2,
            points: 9,
            playerId:
              setup.secondPlayerId,
            displayName:
              "Local Opponent"
          },

          highestScoringWord: {
            word: "WORLD",
            points: 9,
            turnNumber: 2,
            playerId:
              setup.secondPlayerId,
            displayName:
              "Local Opponent"
          },

          experienceEvents:
            expectedEvents
        });

        const retrieved =
          await request(app)
            .get(
              `/api/v1/matches/${setup.matchId}/results`
            )
            .set(
              "Authorization",
              `Bearer ${setup.accessToken}`
            );

        expect(
          retrieved.status
        ).toBe(200);

        expect(
          retrieved.body.data
            .result.highlights
        ).toEqual(
          highlights
        );
      }
    );

    it(
      "returns neutral highlights when a completed match has no stored turns",
      async () => {
        const setup =
          await createGuestMatch();

        const completed =
          await request(app)
            .post(
              `/api/v1/matches/${setup.matchId}/complete`
            )
            .set(
              guestHeader,
              setup.guestSessionToken ??
                ""
            )
            .send({
              reason:
                "STALEMATE",

              players: [
                playerCompletion(
                  setup.firstPlayerId
                ),

                playerCompletion(
                  setup.secondPlayerId
                )
              ]
            });

        expect(
          completed.status
        ).toBe(200);

        expect(
          completed.body.data
            .result.highlights
        ).toEqual({
          totalTurns: 0,
          totalWords: 0,
          bingoCount: 0,

          highestScoringTurn:
            null,

          highestScoringWord:
            null,

          experienceEvents: {
            total: 0,
            leadChanges: 0,
            sharedLeads: 0,
            rankRises: 0,
            comebacks: 0,
            momentumShifts: 0
          }
        });
      }
    );
  }
);
