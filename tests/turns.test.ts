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

interface RegisteredMatchSetup {
  accessToken: string;
  matchId: string;
  firstPlayerId: string;
  secondPlayerId: string;
}

interface GuestMatchSetup {
  guestSessionToken: string;
  matchId: string;
  firstPlayerId: string;
  secondPlayerId: string;
}

function createTurnBody(
  playerId: string,
  word = "HELLO"
) {
  const letters = [
    ...word
  ];

  const placedTiles =
    letters.map(
      (
        letter,
        index
      ) => ({
        id:
          `tile-${index + 1}`,
        letter,
        isBlank: false,
        premium: "NONE"
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
          "Turn Test Owner",
        password:
          "SecurePassword123"
      });

  expect(response.status).toBe(201);

  return response.body.data.tokens
    .accessToken;
}

async function createRegisteredMatch():
  Promise<RegisteredMatchSetup> {
  const accessToken =
    await registerUser(
      "turn-owner@example.com"
    );

  const created =
    await request(app)
      .post("/api/v1/matches")
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        name:
          "Turn Test Match",
        dictionaryPolicy:
          "LOCAL_WORD_LIST"
      });

  expect(created.status).toBe(201);

  const matchId =
    created.body.data.match.id;

  const registeredPlayer =
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
    registeredPlayer.status
  ).toBe(201);

  const localPlayer =
    await request(app)
      .post(
        `/api/v1/matches/${matchId}/players`
      )
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        source: "LOCAL",
        displayName:
          "Local Opponent"
      });

  expect(localPlayer.status).toBe(201);

  const current =
    await request(app)
      .get(
        `/api/v1/matches/${matchId}`
      )
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      );

  expect(current.status).toBe(200);

  const players =
    current.body.data.match.players;

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

  expect(firstPlayer).toBeDefined();
  expect(secondPlayer).toBeDefined();

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

  expect(started.status).toBe(200);

  return {
    accessToken,
    matchId,
    firstPlayerId:
      firstPlayer.id,
    secondPlayerId:
      secondPlayer.id
  };
}

async function createGuestSession():
  Promise<string> {
  const response =
    await request(app)
      .post(
        "/api/v1/guest/sessions"
      )
      .send({});

  expect(response.status).toBe(201);

  return response.body.data
    .guestSessionToken;
}

async function createGuestPlayer(
  guestSessionToken: string,
  displayName: string
): Promise<string> {
  const response =
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

  expect(response.status).toBe(201);

  return response.body.data.player.id;
}

async function createGuestMatch():
  Promise<GuestMatchSetup> {
  const guestSessionToken =
    await createGuestSession();

  const firstGuestPlayerId =
    await createGuestPlayer(
      guestSessionToken,
      "Guest One"
    );

  const secondGuestPlayerId =
    await createGuestPlayer(
      guestSessionToken,
      "Guest Two"
    );

  const created =
    await request(app)
      .post("/api/v1/matches")
      .set(
        guestHeader,
        guestSessionToken
      )
      .send({
        name:
          "Guest Turn Match",
        dictionaryPolicy:
          "LOCAL_WORD_LIST"
      });

  expect(created.status).toBe(201);

  const matchId =
    created.body.data.match.id;

  for (
    const guestPlayerId of [
      firstGuestPlayerId,
      secondGuestPlayerId
    ]
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

    expect(added.status).toBe(201);
  }

  const current =
    await request(app)
      .get(
        `/api/v1/matches/${matchId}`
      )
      .set(
        guestHeader,
        guestSessionToken
      );

  expect(current.status).toBe(200);

  const players =
    current.body.data.match.players;

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

  expect(firstPlayer).toBeDefined();
  expect(secondPlayer).toBeDefined();

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

  expect(started.status).toBe(200);

  return {
    guestSessionToken,
    matchId,
    firstPlayerId:
      firstPlayer.id,
    secondPlayerId:
      secondPlayer.id
  };
}

beforeEach(async () => {
  await resetDatabase();
  await seedLocalTestDictionary();
});

describe(
  "Turn submission",
  () => {
    it("scores and stores a registered player's turn while hiding cumulative totals", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
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
            "registered-turn-001"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId
            )
          );

      expect(response.status).toBe(201);

      expect(
        response.body.data
      ).toMatchObject({
        replayed: false,
        turn: {
          matchId:
            setup.matchId,
          turnNumber: 1,
          wordPoints: 8,
          bingoBonus: 0,
          points: 8,
          placedTileCount: 5,
          replacementTileCount: 5,
          player: {
            id:
              setup.firstPlayerId,
            turnOrder: 1
          },
          words: [
            {
              wordOrder: 1,
              word: "HELLO",
              letterPoints: 8,
              wordMultiplier: 1,
              points: 8
            }
          ]
        },
        nextPlayer: {
          id:
            setup.secondPlayerId,
          turnOrder: 2
        }
      });

      const storedTurn =
        await prisma.turn.findFirst({
          where: {
            matchId:
              setup.matchId
          }
        });

      expect(storedTurn).toMatchObject({
        turnNumber: 1,
        points: 8
      });

      const storedPlayer =
        await prisma.matchPlayer.findUnique({
          where: {
            id:
              setup.firstPlayerId
          }
        });

      expect(
        storedPlayer?.totalPoints
      ).toBe(8);

      const storedMatch =
        await prisma.match.findUnique({
          where: {
            id:
              setup.matchId
          }
        });

      expect(storedMatch).toMatchObject({
        currentTurnOrder: 2,
        nextTurnNumber: 2
      });

      const publicMatch =
        await request(app)
          .get(
            `/api/v1/matches/${setup.matchId}`
          )
          .set(
            "Authorization",
            `Bearer ${setup.accessToken}`
          );

      expect(publicMatch.status).toBe(200);

      const serialized =
        JSON.stringify(
          publicMatch.body.data.match
        );

      expect(
        serialized
      ).not.toContain(
        "totalPoints"
      );

      expect(
        serialized.toLowerCase()
      ).not.toContain(
        "score"
      );
    });

    it("replays an identical idempotent request without adding points twice", async () => {
      const setup =
        await createRegisteredMatch();

      const body =
        createTurnBody(
          setup.firstPlayerId
        );

      const first =
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
            "registered-turn-002"
          )
          .send(body);

      expect(first.status).toBe(201);

      const replay =
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
            "registered-turn-002"
          )
          .send(body);

      expect(replay.status).toBe(200);

      expect(
        replay.body.data.replayed
      ).toBe(true);

      expect(
        replay.body.data.turn.id
      ).toBe(
        first.body.data.turn.id
      );

      expect(
        await prisma.turn.count({
          where: {
            matchId:
              setup.matchId
          }
        })
      ).toBe(1);

      const player =
        await prisma.matchPlayer.findUnique({
          where: {
            id:
              setup.firstPlayerId
          }
        });

      expect(
        player?.totalPoints
      ).toBe(8);
    });

    it("rejects reuse of an idempotency key for a different turn", async () => {
      const setup =
        await createRegisteredMatch();

      const first =
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
            "registered-turn-003"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId,
              "HELLO"
            )
          );

      expect(first.status).toBe(201);

      const reused =
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
            "registered-turn-003"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId,
              "WORLD"
            )
          );

      expect(reused.status).toBe(409);

      expect(
        reused.body.error.code
      ).toBe(
        "IDEMPOTENCY_KEY_REUSED"
      );
    });

    it("rejects invalid words without writing or advancing the turn", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
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
            "registered-turn-004"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId,
              "ZZZZ"
            )
          );

      expect(response.status).toBe(422);

      expect(
        response.body.error.code
      ).toBe(
        "TURN_WORDS_INVALID"
      );

      expect(
        await prisma.turn.count({
          where: {
            matchId:
              setup.matchId
          }
        })
      ).toBe(0);

      const match =
        await prisma.match.findUnique({
          where: {
            id:
              setup.matchId
          }
        });

      expect(match).toMatchObject({
        currentTurnOrder: 1,
        nextTurnNumber: 1
      });

      const player =
        await prisma.matchPlayer.findUnique({
          where: {
            id:
              setup.firstPlayerId
          }
        });

      expect(
        player?.totalPoints
      ).toBe(0);
    });

    it("rejects a player who is not the current player", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
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
            "registered-turn-005"
          )
          .send(
            createTurnBody(
              setup.secondPlayerId
            )
          );

      expect(response.status).toBe(409);

      expect(
        response.body.error.code
      ).toBe(
        "PLAYER_NOT_CURRENT_TURN"
      );

      expect(
        await prisma.turn.count({
          where: {
            matchId:
              setup.matchId
          }
        })
      ).toBe(0);
    });

    it("requires an idempotency key", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${setup.matchId}/turns`
          )
          .set(
            "Authorization",
            `Bearer ${setup.accessToken}`
          )
          .send(
            createTurnBody(
              setup.firstPlayerId
            )
          );

      expect(response.status).toBe(400);

      expect(
        response.body.error.code
      ).toBe(
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    });

    it("supports guest-owned match turns", async () => {
      const setup =
        await createGuestMatch();

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${setup.matchId}/turns`
          )
          .set(
            guestHeader,
            setup.guestSessionToken
          )
          .set(
            "Idempotency-Key",
            "guest-turn-001"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId
            )
          );

      expect(response.status).toBe(201);

      expect(
        response.body.data
      ).toMatchObject({
        replayed: false,
        turn: {
          turnNumber: 1,
          points: 8,
          player: {
            id:
              setup.firstPlayerId
          }
        },
        nextPlayer: {
          id:
            setup.secondPlayerId
        }
      });
    });

    it("applies premium squares through the turn endpoint", async () => {
      const setup =
        await createRegisteredMatch();

      const body =
        createTurnBody(
          setup.firstPlayerId
        );

      body.placedTiles =
        body.placedTiles.map(
          (
            tile,
            index
          ) => ({
            ...tile,
            premium:
              index === 0
                ? "TRIPLE_LETTER"
                : index === 4
                  ? "DOUBLE_WORD"
                  : "NONE"
          })
        );

      const response =
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
            "premium-turn-001"
          )
          .send(body);

      expect(response.status).toBe(201);

      expect(
        response.body.data.turn
      ).toMatchObject({
        wordPoints: 32,
        bingoBonus: 0,
        points: 32,
        placedTileCount: 5,
        replacementTileCount: 5,
        words: [
          {
            word: "HELLO",
            letterPoints: 16,
            wordMultiplier: 2,
            points: 32
          }
        ]
      });

      const player =
        await prisma.matchPlayer.findUnique({
          where: {
            id:
              setup.firstPlayerId
          }
        });

      expect(
        player?.totalPoints
      ).toBe(32);
    });

    it("scores multiple cross-words that share a placed tile", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
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
            "cross-word-turn-001"
          )
          .send({
            playerId:
              setup.firstPlayerId,
            placedTiles: [
              {
                id: "shared-o",
                letter: "O",
                isBlank: false,
                premium: "NONE"
              }
            ],
            words: [
              {
                tiles: [
                  {
                    source: "EXISTING",
                    letter: "H",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "E",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "L",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "L",
                    isBlank: false
                  },
                  {
                    source: "PLACED",
                    placedTileId:
                      "shared-o"
                  }
                ]
              },
              {
                tiles: [
                  {
                    source: "EXISTING",
                    letter: "W",
                    isBlank: false
                  },
                  {
                    source: "PLACED",
                    placedTileId:
                      "shared-o"
                  },
                  {
                    source: "EXISTING",
                    letter: "R",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "L",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "D",
                    isBlank: false
                  }
                ]
              }
            ]
          });

      expect(response.status).toBe(201);

      expect(
        response.body.data.turn
      ).toMatchObject({
        wordPoints: 17,
        bingoBonus: 0,
        points: 17,
        placedTileCount: 1,
        replacementTileCount: 1,
        words: [
          {
            word: "HELLO",
            points: 8
          },
          {
            word: "WORLD",
            points: 9
          }
        ]
      });
    });

    it("awards the fifty-point bonus when seven tiles are placed", async () => {
      const setup =
        await createRegisteredMatch();

      const response =
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
            "bingo-turn-001"
          )
          .send({
            playerId:
              setup.firstPlayerId,
            placedTiles: [
              {
                id: "h",
                letter: "H",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "e",
                letter: "E",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "l-one",
                letter: "L",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "l-two",
                letter: "L",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "o",
                letter: "O",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "w",
                letter: "W",
                isBlank: false,
                premium: "NONE"
              },
              {
                id: "d",
                letter: "D",
                isBlank: false,
                premium: "NONE"
              }
            ],
            words: [
              {
                tiles: [
                  {
                    source: "PLACED",
                    placedTileId: "h"
                  },
                  {
                    source: "PLACED",
                    placedTileId: "e"
                  },
                  {
                    source: "PLACED",
                    placedTileId:
                      "l-one"
                  },
                  {
                    source: "PLACED",
                    placedTileId:
                      "l-two"
                  },
                  {
                    source: "PLACED",
                    placedTileId: "o"
                  }
                ]
              },
              {
                tiles: [
                  {
                    source: "PLACED",
                    placedTileId: "w"
                  },
                  {
                    source: "PLACED",
                    placedTileId: "o"
                  },
                  {
                    source: "EXISTING",
                    letter: "R",
                    isBlank: false
                  },
                  {
                    source: "EXISTING",
                    letter: "L",
                    isBlank: false
                  },
                  {
                    source: "PLACED",
                    placedTileId: "d"
                  }
                ]
              }
            ]
          });

      expect(response.status).toBe(201);

      expect(
        response.body.data.turn
      ).toMatchObject({
        wordPoints: 17,
        bingoBonus: 50,
        points: 67,
        placedTileCount: 7,
        replacementTileCount: 7
      });

      const player =
        await prisma.matchPlayer.findUnique({
          where: {
            id:
              setup.firstPlayerId
          }
        });

      expect(
        player?.totalPoints
      ).toBe(67);
    });

    it("advances sequential turns and wraps back to the first player", async () => {
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
            "sequence-turn-001"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId,
              "HELLO"
            )
          );

      expect(firstTurn.status).toBe(201);

      expect(
        firstTurn.body.data.nextPlayer.id
      ).toBe(
        setup.secondPlayerId
      );

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
            "sequence-turn-002"
          )
          .send(
            createTurnBody(
              setup.secondPlayerId,
              "WORLD"
            )
          );

      expect(secondTurn.status).toBe(201);

      expect(
        secondTurn.body.data
      ).toMatchObject({
        turn: {
          turnNumber: 2,
          points: 9,
          player: {
            id:
              setup.secondPlayerId
          }
        },
        nextPlayer: {
          id:
            setup.firstPlayerId,
          turnOrder: 1
        }
      });

      const match =
        await prisma.match.findUnique({
          where: {
            id:
              setup.matchId
          }
        });

      expect(match).toMatchObject({
        currentTurnOrder: 1,
        nextTurnNumber: 3
      });

      const turns =
        await prisma.turn.findMany({
          where: {
            matchId:
              setup.matchId
          },
          orderBy: {
            turnNumber: "asc"
          }
        });

      expect(
        turns.map(
          (turn) =>
            turn.turnNumber
        )
      ).toEqual([
        1,
        2
      ]);
    });

    it("does not expose another owner's match through the turn endpoint", async () => {
      const setup =
        await createRegisteredMatch();

      const intruderToken =
        await registerUser(
          "turn-intruder@example.com"
        );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${setup.matchId}/turns`
          )
          .set(
            "Authorization",
            `Bearer ${intruderToken}`
          )
          .set(
            "Idempotency-Key",
            "ownership-turn-001"
          )
          .send(
            createTurnBody(
              setup.firstPlayerId
            )
          );

      expect(response.status).toBe(404);

      expect(
        response.body.error.code
      ).toBe(
        "MATCH_NOT_FOUND"
      );

      expect(
        await prisma.turn.count({
          where: {
            matchId:
              setup.matchId
          }
        })
      ).toBe(0);

      const match =
        await prisma.match.findUnique({
          where: {
            id:
              setup.matchId
          }
        });

      expect(match).toMatchObject({
        currentTurnOrder: 1,
        nextTurnNumber: 1
      });
    });

  }
);
