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

import {
  seedLocalTestDictionary
} from "./helpers/seed-local-dictionary.js";

const guestHeader =
  "x-guest-session-token";

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

async function createGuestMatch(
  guestSessionToken: string
): Promise<string> {
  const response =
    await request(app)
      .post("/api/v1/matches")
      .set(
        guestHeader,
        guestSessionToken
      )
      .send({
        name:
          "Guest Dictionary Match",
        dictionaryPolicy:
          "LOCAL_WORD_LIST"
      });

  expect(response.status).toBe(201);

  return response.body.data.match.id;
}

async function addGuestPlayer(
  guestSessionToken: string,
  matchId: string,
  guestPlayerId: string
): Promise<void> {
  const response =
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

  expect(response.status).toBe(201);
}

beforeEach(async () => {
  await resetDatabase();
  await seedLocalTestDictionary();
});

describe(
  "Guest local dictionary validation",
  () => {
    it("locks a local lexicon and validates guest match words", async () => {
      const guestSessionToken =
        await createGuestSession();

      const firstPlayerId =
        await createGuestPlayer(
          guestSessionToken,
          "Marcus"
        );

      const secondPlayerId =
        await createGuestPlayer(
          guestSessionToken,
          "Lerato"
        );

      const matchId =
        await createGuestMatch(
          guestSessionToken
        );

      await addGuestPlayer(
        guestSessionToken,
        matchId,
        firstPlayerId
      );

      await addGuestPlayer(
        guestSessionToken,
        matchId,
        secondPlayerId
      );

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

      expect(
        started.body.data.match
          .dictionaryLexicon
      ).toMatchObject({
        code:
          "LOCAL_STARTER",
        version:
          "1.0.0",
        name:
          "ScrabbleCalculator Local Starter Lexicon"
      });

      const validation =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            guestHeader,
            guestSessionToken
          )
          .send({
            words: [
              "hello",
              "QUZI"
            ]
          });

      expect(
        validation.status
      ).toBe(200);

      expect(
        validation.body.data.validation
          .accepted
      ).toBe(false);

      expect(
        validation.body.data.validation
          .words[0]
      ).toMatchObject({
        submittedWord: "hello",
        normalizedWord: "HELLO",
        accepted: true,
        suggestions: []
      });

      expect(
        validation.body.data.validation
          .words[1]
      ).toMatchObject({
        submittedWord: "QUZI",
        normalizedWord: "QUZI",
        accepted: false
      });

      expect(
        validation.body.data.validation
          .words[1].suggestions
      ).toContain("QUIZ");
    });

    it("does not reveal a guest match to another guest session", async () => {
      const ownerToken =
        await createGuestSession();

      const otherToken =
        await createGuestSession();

      const firstPlayerId =
        await createGuestPlayer(
          ownerToken,
          "Owner One"
        );

      const secondPlayerId =
        await createGuestPlayer(
          ownerToken,
          "Owner Two"
        );

      const matchId =
        await createGuestMatch(
          ownerToken
        );

      await addGuestPlayer(
        ownerToken,
        matchId,
        firstPlayerId
      );

      await addGuestPlayer(
        ownerToken,
        matchId,
        secondPlayerId
      );

      const started =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/start`
          )
          .set(
            guestHeader,
            ownerToken
          )
          .send({});

      expect(started.status).toBe(200);

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            guestHeader,
            otherToken
          )
          .send({
            words: [
              "QUIZ"
            ]
          });

      expect(response.status).toBe(404);

      expect(
        response.body.error.code
      ).toBe("MATCH_NOT_FOUND");
    });
  }
);
