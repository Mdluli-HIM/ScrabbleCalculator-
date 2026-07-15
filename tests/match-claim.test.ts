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

beforeEach(async () => {
  await resetDatabase();
});

describe("Guest match claiming", () => {
  it("transfers guest-owned matches to the registered user", async () => {
    const guestSession =
      await request(app)
        .post(
          "/api/v1/guest/sessions"
        )
        .send({});

    expect(
      guestSession.status
    ).toBe(201);

    const guestSessionToken =
      guestSession.body.data
        .guestSessionToken;

    const firstPlayer =
      await request(app)
        .post(
          "/api/v1/guest/players"
        )
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({
          displayName: "Marcus"
        });

    const secondPlayer =
      await request(app)
        .post(
          "/api/v1/guest/players"
        )
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({
          displayName: "Lerato"
        });

    expect(
      firstPlayer.status
    ).toBe(201);

    expect(
      secondPlayer.status
    ).toBe(201);

    const createdMatch =
      await request(app)
        .post("/api/v1/matches")
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({
          name:
            "Guest Match To Claim",
          dictionaryPolicy:
            "OXFORD_ONLY"
        });

    expect(
      createdMatch.status
    ).toBe(201);

    const matchId =
      createdMatch.body.data.match.id;

    for (
      const guestPlayerId of [
        firstPlayer.body.data.player.id,
        secondPlayer.body.data.player.id
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

    const registered =
      await request(app)
        .post(
          "/api/v1/auth/register"
        )
        .send({
          email:
            "claimed-owner@example.com",
          displayName:
            "Claimed Owner",
          password:
            "SecurePassword123"
        });

    expect(
      registered.status
    ).toBe(201);

    const accessToken =
      registered.body.data.tokens
        .accessToken;

    const userId =
      registered.body.data.user.id;

    const claimed =
      await request(app)
        .post(
          "/api/v1/guest/claim"
        )
        .set(
          "Authorization",
          `Bearer ${accessToken}`
        )
        .set(
          guestHeader,
          guestSessionToken
        )
        .send({});

    expect(claimed.status).toBe(200);

    expect(
      claimed.body.data.guestSession
        .claimedByUserId
    ).toBe(userId);

    const oldGuestAccess =
      await request(app)
        .get(
          `/api/v1/matches/${matchId}`
        )
        .set(
          guestHeader,
          guestSessionToken
        );

    expect(
      oldGuestAccess.status
    ).toBe(409);

    expect(
      oldGuestAccess.body.error.code
    ).toBe(
      "GUEST_SESSION_ALREADY_CLAIMED"
    );

    const registeredAccess =
      await request(app)
        .get(
          `/api/v1/matches/${matchId}`
        )
        .set(
          "Authorization",
          `Bearer ${accessToken}`
        );

    expect(
      registeredAccess.status
    ).toBe(200);

    expect(
      registeredAccess.body.data.match
    ).toMatchObject({
      id: matchId,
      ownerType:
        "REGISTERED_USER",
      playerCount: 2
    });

    const registeredList =
      await request(app)
        .get("/api/v1/matches")
        .set(
          "Authorization",
          `Bearer ${accessToken}`
        );

    expect(
      registeredList.status
    ).toBe(200);

    expect(
      registeredList.body.data.total
    ).toBe(1);

    expect(
      registeredList.body.data
        .matches[0].id
    ).toBe(matchId);
  });
});
