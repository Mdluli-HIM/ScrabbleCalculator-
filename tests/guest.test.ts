import request from "supertest";

import {
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import { app } from "../src/app.js";
import {
  prisma
} from "../src/lib/database.js";

const guestHeader =
  "x-guest-session-token";

async function createTestGuestSession() {
  return request(app)
    .post("/api/v1/guest/sessions")
    .send({});
}

async function registerTestUser() {
  return request(app)
    .post("/api/v1/auth/register")
    .send({
      email:
        "guest-owner@example.com",
      displayName:
        "Guest Owner",
      password:
        "SecurePassword123"
    });
}

beforeEach(async () => {
  await prisma.refreshSession.deleteMany();
  await prisma.guestPlayer.deleteMany();
  await prisma.guestSession.deleteMany();
  await prisma.user.deleteMany();
});

describe("Guest sessions", () => {
  it("creates and retrieves a guest session", async () => {
    const created =
      await createTestGuestSession();

    expect(created.status).toBe(201);

    const token =
      created.body.data
        .guestSessionToken;

    expect(token).toEqual(
      expect.any(String)
    );

    const current =
      await request(app)
        .get(
          "/api/v1/guest/sessions/current"
        )
        .set(guestHeader, token);

    expect(current.status).toBe(200);

    expect(
      current.body.data
        .guestSession.players
    ).toEqual([]);
  });

  it("rejects guest endpoints without a guest token", async () => {
    const response =
      await request(app)
        .get("/api/v1/guest/players");

    expect(response.status).toBe(401);

    expect(
      response.body.error.code
    ).toBe(
      "GUEST_SESSION_REQUIRED"
    );
  });

  it("adds and lists guest players while rejecting duplicate names", async () => {
    const created =
      await createTestGuestSession();

    const token =
      created.body.data
        .guestSessionToken;

    const firstPlayer =
      await request(app)
        .post("/api/v1/guest/players")
        .set(guestHeader, token)
        .send({
          displayName: "Marcus"
        });

    expect(firstPlayer.status).toBe(201);

    const duplicate =
      await request(app)
        .post("/api/v1/guest/players")
        .set(guestHeader, token)
        .send({
          displayName: "  MARCUS "
        });

    expect(duplicate.status).toBe(409);

    expect(
      duplicate.body.error.code
    ).toBe(
      "GUEST_PLAYER_ALREADY_EXISTS"
    );

    const players =
      await request(app)
        .get("/api/v1/guest/players")
        .set(guestHeader, token);

    expect(players.status).toBe(200);
    expect(players.body.data.total).toBe(1);

    expect(
      players.body.data.players[0]
    ).toMatchObject({
      displayName: "Marcus"
    });
  });

  it("allows a maximum of four guest players", async () => {
    const created =
      await createTestGuestSession();

    const token =
      created.body.data
        .guestSessionToken;

    for (
      const displayName of [
        "Marcus",
        "Lerato",
        "Thabo",
        "Naledi"
      ]
    ) {
      const response =
        await request(app)
          .post(
            "/api/v1/guest/players"
          )
          .set(guestHeader, token)
          .send({
            displayName
          });

      expect(response.status).toBe(201);
    }

    const fifthPlayer =
      await request(app)
        .post("/api/v1/guest/players")
        .set(guestHeader, token)
        .send({
          displayName: "Sipho"
        });

    expect(fifthPlayer.status).toBe(409);

    expect(
      fifthPlayer.body.error.code
    ).toBe(
      "GUEST_PLAYER_LIMIT_REACHED"
    );
  });

  it("removes a guest player", async () => {
    const created =
      await createTestGuestSession();

    const token =
      created.body.data
        .guestSessionToken;

    const addedPlayer =
      await request(app)
        .post("/api/v1/guest/players")
        .set(guestHeader, token)
        .send({
          displayName: "Marcus"
        });

    const playerId =
      addedPlayer.body.data.player.id;

    const removed =
      await request(app)
        .delete(
          `/api/v1/guest/players/${playerId}`
        )
        .set(guestHeader, token);

    expect(removed.status).toBe(200);

    const players =
      await request(app)
        .get("/api/v1/guest/players")
        .set(guestHeader, token);

    expect(players.body.data.total).toBe(0);
  });

  it("allows a registered user to claim a guest session", async () => {
    const createdGuest =
      await createTestGuestSession();

    const guestToken =
      createdGuest.body.data
        .guestSessionToken;

    await request(app)
      .post("/api/v1/guest/players")
      .set(guestHeader, guestToken)
      .send({
        displayName: "Marcus"
      });

    const registration =
      await registerTestUser();

    const accessToken =
      registration.body.data
        .tokens.accessToken;

    const claimed =
      await request(app)
        .post("/api/v1/guest/claim")
        .set(
          "Authorization",
          `Bearer ${accessToken}`
        )
        .set(
          guestHeader,
          guestToken
        )
        .send({});

    expect(claimed.status).toBe(200);

    expect(
      claimed.body.data
        .guestSession.claimedByUserId
    ).toBe(
      registration.body.data.user.id
    );

    expect(
      claimed.body.data
        .guestSession.players
    ).toHaveLength(1);

    const reusedGuestToken =
      await request(app)
        .get("/api/v1/guest/players")
        .set(
          guestHeader,
          guestToken
        );

    expect(
      reusedGuestToken.status
    ).toBe(409);

    expect(
      reusedGuestToken.body.error.code
    ).toBe(
      "GUEST_SESSION_ALREADY_CLAIMED"
    );
  });
});
