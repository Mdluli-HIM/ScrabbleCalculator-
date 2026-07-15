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
  resetDatabase
} from "./helpers/reset-database.js";

const guestHeader =
  "x-guest-session-token";

interface RegisteredIdentity {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

interface GuestIdentity {
  guestSessionToken: string;
  guestSessionId: string;
}

async function registerUser(
  email: string,
  displayName: string
): Promise<RegisteredIdentity> {
  const response =
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        email,
        displayName,
        password:
          "SecurePassword123"
      });

  expect(response.status).toBe(201);

  return {
    userId:
      response.body.data.user.id,
    accessToken:
      response.body.data.tokens.accessToken,
    refreshToken:
      response.body.data.tokens.refreshToken
  };
}

async function createGuestIdentity():
  Promise<GuestIdentity> {
  const response =
    await request(app)
      .post("/api/v1/guest/sessions")
      .send({});

  expect(response.status).toBe(201);

  return {
    guestSessionToken:
      response.body.data.guestSessionToken,
    guestSessionId:
      response.body.data.guestSession.id
  };
}

async function createGuestPlayer(
  guestSessionToken: string,
  displayName: string
): Promise<string> {
  const response =
    await request(app)
      .post("/api/v1/guest/players")
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

async function createRegisteredMatch(
  accessToken: string,
  overrides: Record<string, unknown> = {}
) {
  return request(app)
    .post("/api/v1/matches")
    .set(
      "Authorization",
      `Bearer ${accessToken}`
    )
    .send({
      name: "Family Scrabble",
      dictionaryPolicy:
        "OXFORD_ONLY",
      ...overrides
    });
}

async function addRegisteredMatchPlayer(
  accessToken: string,
  matchId: string
) {
  return request(app)
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
}

async function addLocalMatchPlayer(
  accessToken: string,
  matchId: string,
  displayName: string
) {
  return request(app)
    .post(
      `/api/v1/matches/${matchId}/players`
    )
    .set(
      "Authorization",
      `Bearer ${accessToken}`
    )
    .send({
      source: "LOCAL",
      displayName
    });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Match setup", () => {
  it("requires exactly one registered or guest identity", async () => {
    const missingIdentity =
      await request(app)
        .post("/api/v1/matches")
        .send({
          dictionaryPolicy:
            "OXFORD_ONLY"
        });

    expect(
      missingIdentity.status
    ).toBe(401);

    expect(
      missingIdentity.body.error.code
    ).toBe("MATCH_ACTOR_REQUIRED");

    const registered =
      await registerUser(
        "actor@example.com",
        "Registered Actor"
      );

    const guest =
      await createGuestIdentity();

    const ambiguous =
      await request(app)
        .post("/api/v1/matches")
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .set(
          guestHeader,
          guest.guestSessionToken
        )
        .send({
          dictionaryPolicy:
            "OXFORD_ONLY"
        });

    expect(ambiguous.status).toBe(400);

    expect(
      ambiguous.body.error.code
    ).toBe(
      "AMBIGUOUS_MATCH_AUTHENTICATION"
    );
  });

  it("creates, updates, lists and retrieves a registered match safely", async () => {
    const registered =
      await registerUser(
        "registered-owner@example.com",
        "Marcus"
      );

    const created =
      await createRegisteredMatch(
        registered.accessToken,
        {
          name:
            "  Family   Championship  ",
          dictionaryPolicy:
            "TOURNAMENT_LEXICON_ONLY"
        }
      );

    expect(created.status).toBe(201);

    const createdMatch =
      created.body.data.match;

    expect(createdMatch).toMatchObject({
      name: "Family Championship",
      status: "DRAFT",
      dictionaryPolicy:
        "TOURNAMENT_LEXICON_ONLY",
      ownerType:
        "REGISTERED_USER",
      currentTurnOrder: null,
      currentPlayer: null,
      playerCount: 0,
      canEdit: true,
      players: []
    });

    expect(
      JSON.stringify(createdMatch)
        .toLowerCase()
    ).not.toContain("score");

    const updated =
      await request(app)
        .patch(
          `/api/v1/matches/${createdMatch.id}`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({
          name: null,
          dictionaryPolicy:
            "EITHER_ACCEPTED"
        });

    expect(updated.status).toBe(200);

    expect(
      updated.body.data.match
    ).toMatchObject({
      name: null,
      status: "DRAFT",
      dictionaryPolicy:
        "EITHER_ACCEPTED"
    });

    const listed =
      await request(app)
        .get("/api/v1/matches")
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        );

    expect(listed.status).toBe(200);
    expect(listed.body.data.total).toBe(1);

    const retrieved =
      await request(app)
        .get(
          `/api/v1/matches/${createdMatch.id}`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        );

    expect(retrieved.status).toBe(200);

    expect(
      retrieved.body.data.match.id
    ).toBe(createdMatch.id);
  });

  it("adds, orders and starts registered match players", async () => {
    const registered =
      await registerUser(
        "start@example.com",
        "Marcus"
      );

    const created =
      await createRegisteredMatch(
        registered.accessToken
      );

    const matchId =
      created.body.data.match.id;

    const registeredPlayer =
      await addRegisteredMatchPlayer(
        registered.accessToken,
        matchId
      );

    expect(
      registeredPlayer.status
    ).toBe(201);

    const registeredPlayerId =
      registeredPlayer.body.data.match
        .players[0].id;

    const localPlayer =
      await addLocalMatchPlayer(
        registered.accessToken,
        matchId,
        "Lerato"
      );

    expect(localPlayer.status).toBe(201);

    const localPlayerId =
      localPlayer.body.data.match
        .players.find(
          (
            player: {
              displayName: string;
              id: string;
            }
          ) =>
            player.displayName ===
            "Lerato"
        ).id;

    const reordered =
      await request(app)
        .put(
          `/api/v1/matches/${matchId}/players/order`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({
          seatOrder: [
            localPlayerId,
            registeredPlayerId
          ],
          turnOrder: [
            registeredPlayerId,
            localPlayerId
          ]
        });

    expect(reordered.status).toBe(200);

    expect(
      reordered.body.data.match.players
    ).toMatchObject([
      {
        id: localPlayerId,
        seatNumber: 1,
        turnOrder: 2
      },
      {
        id: registeredPlayerId,
        seatNumber: 2,
        turnOrder: 1
      }
    ]);

    const started =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/start`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({});

    expect(started.status).toBe(200);

    expect(
      started.body.data.match
    ).toMatchObject({
      status: "IN_PROGRESS",
      currentTurnOrder: 1,
      canEdit: false
    });

    expect(
      started.body.data.match
        .currentPlayer.id
    ).toBe(registeredPlayerId);

    const editAfterStart =
      await request(app)
        .patch(
          `/api/v1/matches/${matchId}`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({
          name: "Changed Name"
        });

    expect(
      editAfterStart.status
    ).toBe(409);

    expect(
      editAfterStart.body.error.code
    ).toBe("MATCH_NOT_EDITABLE");
  });

  it("enforces duplicate names, minimum players and the four-player limit", async () => {
    const registered =
      await registerUser(
        "limits@example.com",
        "Match Owner"
      );

    const created =
      await createRegisteredMatch(
        registered.accessToken
      );

    const matchId =
      created.body.data.match.id;

    const startTooEarly =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/start`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({});

    expect(
      startTooEarly.status
    ).toBe(409);

    expect(
      startTooEarly.body.error.code
    ).toBe(
      "MATCH_REQUIRES_MORE_PLAYERS"
    );

    await addLocalMatchPlayer(
      registered.accessToken,
      matchId,
      "Marcus"
    );

    const duplicateName =
      await addLocalMatchPlayer(
        registered.accessToken,
        matchId,
        "  MARCUS  "
      );

    expect(
      duplicateName.status
    ).toBe(409);

    expect(
      duplicateName.body.error.code
    ).toBe(
      "MATCH_PLAYER_NAME_ALREADY_EXISTS"
    );

    for (
      const displayName of [
        "Lerato",
        "Thabo",
        "Naledi"
      ]
    ) {
      const added =
        await addLocalMatchPlayer(
          registered.accessToken,
          matchId,
          displayName
        );

      expect(added.status).toBe(201);
    }

    const fifthPlayer =
      await addLocalMatchPlayer(
        registered.accessToken,
        matchId,
        "Sipho"
      );

    expect(fifthPlayer.status).toBe(409);

    expect(
      fifthPlayer.body.error.code
    ).toBe(
      "MATCH_PLAYER_LIMIT_REACHED"
    );
  });

  it("removes a player and restores continuous ordering", async () => {
    const registered =
      await registerUser(
        "remove@example.com",
        "Match Owner"
      );

    const created =
      await createRegisteredMatch(
        registered.accessToken
      );

    const matchId =
      created.body.data.match.id;

    await addLocalMatchPlayer(
      registered.accessToken,
      matchId,
      "Marcus"
    );

    const second =
      await addLocalMatchPlayer(
        registered.accessToken,
        matchId,
        "Lerato"
      );

    await addLocalMatchPlayer(
      registered.accessToken,
      matchId,
      "Thabo"
    );

    const secondPlayerId =
      second.body.data.match.players.find(
        (
          player: {
            displayName: string;
            id: string;
          }
        ) =>
          player.displayName ===
          "Lerato"
      ).id;

    const removed =
      await request(app)
        .delete(
          `/api/v1/matches/${matchId}/players/${secondPlayerId}`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        );

    expect(removed.status).toBe(200);

    expect(
      removed.body.data.match.playerCount
    ).toBe(2);

    expect(
      removed.body.data.match.players.map(
        (
          player: {
            seatNumber: number;
          }
        ) => player.seatNumber
      )
    ).toEqual([1, 2]);

    expect(
      removed.body.data.match.players.map(
        (
          player: {
            turnOrder: number;
          }
        ) => player.turnOrder
      )
    ).toEqual([1, 2]);

    expect(
      removed.body.data.match.players.some(
        (
          player: {
            id: string;
          }
        ) =>
          player.id ===
          secondPlayerId
      )
    ).toBe(false);
  });

  it("prevents one registered user from reading another user's match", async () => {
    const firstUser =
      await registerUser(
        "owner-one@example.com",
        "Owner One"
      );

    const secondUser =
      await registerUser(
        "owner-two@example.com",
        "Owner Two"
      );

    const created =
      await createRegisteredMatch(
        firstUser.accessToken
      );

    const matchId =
      created.body.data.match.id;

    const unauthorizedRead =
      await request(app)
        .get(
          `/api/v1/matches/${matchId}`
        )
        .set(
          "Authorization",
          `Bearer ${secondUser.accessToken}`
        );

    expect(
      unauthorizedRead.status
    ).toBe(404);

    expect(
      unauthorizedRead.body.error.code
    ).toBe("MATCH_NOT_FOUND");

    const secondUserList =
      await request(app)
        .get("/api/v1/matches")
        .set(
          "Authorization",
          `Bearer ${secondUser.accessToken}`
        );

    expect(secondUserList.status).toBe(200);
    expect(
      secondUserList.body.data.total
    ).toBe(0);
  });

  it("creates and starts a guest-owned match using guest players", async () => {
    const guest =
      await createGuestIdentity();

    const marcusId =
      await createGuestPlayer(
        guest.guestSessionToken,
        "Marcus"
      );

    const leratoId =
      await createGuestPlayer(
        guest.guestSessionToken,
        "Lerato"
      );

    const created =
      await request(app)
        .post("/api/v1/matches")
        .set(
          guestHeader,
          guest.guestSessionToken
        )
        .send({
          name: "Guest Match",
          dictionaryPolicy:
            "BOTH_REQUIRED"
        });

    expect(created.status).toBe(201);

    const matchId =
      created.body.data.match.id;

    for (
      const guestPlayerId of [
        marcusId,
        leratoId
      ]
    ) {
      const added =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/players`
          )
          .set(
            guestHeader,
            guest.guestSessionToken
          )
          .send({
            source:
              "GUEST_PLAYER",
            guestPlayerId
          });

      expect(added.status).toBe(201);
    }

    const started =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/start`
        )
        .set(
          guestHeader,
          guest.guestSessionToken
        )
        .send({});

    expect(started.status).toBe(200);

    expect(
      started.body.data.match
    ).toMatchObject({
      ownerType: "GUEST_SESSION",
      status: "IN_PROGRESS",
      dictionaryPolicy:
        "BOTH_REQUIRED",
      playerCount: 2,
      currentTurnOrder: 1
    });

    expect(
      JSON.stringify(
        started.body.data.match
      ).toLowerCase()
    ).not.toContain("score");
  });

  it("prevents cross-session guest players and registered identities in guest matches", async () => {
    const firstGuest =
      await createGuestIdentity();

    const secondGuest =
      await createGuestIdentity();

    const foreignGuestPlayerId =
      await createGuestPlayer(
        secondGuest.guestSessionToken,
        "Foreign Player"
      );

    const created =
      await request(app)
        .post("/api/v1/matches")
        .set(
          guestHeader,
          firstGuest.guestSessionToken
        )
        .send({
          dictionaryPolicy:
            "EITHER_ACCEPTED"
        });

    const matchId =
      created.body.data.match.id;

    const foreignPlayer =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/players`
        )
        .set(
          guestHeader,
          firstGuest.guestSessionToken
        )
        .send({
          source:
            "GUEST_PLAYER",
          guestPlayerId:
            foreignGuestPlayerId
        });

    expect(foreignPlayer.status).toBe(404);

    expect(
      foreignPlayer.body.error.code
    ).toBe("GUEST_PLAYER_NOT_FOUND");

    const registeredIdentity =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/players`
        )
        .set(
          guestHeader,
          firstGuest.guestSessionToken
        )
        .send({
          source:
            "REGISTERED_USER"
        });

    expect(
      registeredIdentity.status
    ).toBe(403);

    expect(
      registeredIdentity.body.error.code
    ).toBe(
      "REGISTERED_PLAYER_NOT_ALLOWED"
    );
  });

  it("cancels an active match and rejects repeated cancellation", async () => {
    const registered =
      await registerUser(
        "cancel@example.com",
        "Match Owner"
      );

    const created =
      await createRegisteredMatch(
        registered.accessToken
      );

    const matchId =
      created.body.data.match.id;

    await addLocalMatchPlayer(
      registered.accessToken,
      matchId,
      "Marcus"
    );

    await addLocalMatchPlayer(
      registered.accessToken,
      matchId,
      "Lerato"
    );

    const started =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/start`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({});

    expect(started.status).toBe(200);

    const cancelled =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/cancel`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({});

    expect(cancelled.status).toBe(200);

    expect(
      cancelled.body.data.match
    ).toMatchObject({
      status: "CANCELLED",
      currentTurnOrder: null,
      currentPlayer: null,
      canEdit: false
    });

    expect(
      cancelled.body.data.match
        .cancelledAt
    ).toEqual(expect.any(String));

    const repeatedCancellation =
      await request(app)
        .post(
          `/api/v1/matches/${matchId}/cancel`
        )
        .set(
          "Authorization",
          `Bearer ${registered.accessToken}`
        )
        .send({});

    expect(
      repeatedCancellation.status
    ).toBe(409);

    expect(
      repeatedCancellation.body.error.code
    ).toBe("MATCH_NOT_CANCELLABLE");
  });
});
