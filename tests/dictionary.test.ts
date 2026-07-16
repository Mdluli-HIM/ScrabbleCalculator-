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
          "Dictionary Player",
        password:
          "SecurePassword123"
      });

  expect(response.status).toBe(201);

  return response.body.data.tokens
    .accessToken;
}

async function createMatch(
  accessToken: string,
  dictionaryPolicy:
    | "LOCAL_WORD_LIST"
    | "OXFORD_ONLY"
): Promise<string> {
  const response =
    await request(app)
      .post("/api/v1/matches")
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      )
      .send({
        name:
          "Dictionary Test Match",
        dictionaryPolicy
      });

  expect(response.status).toBe(201);

  return response.body.data.match.id;
}

async function addPlayersAndStart(
  accessToken: string,
  matchId: string
): Promise<void> {
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
          "Local Player"
      });

  expect(
    localPlayer.status
  ).toBe(201);

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
}

beforeEach(async () => {
  await resetDatabase();
  await seedLocalTestDictionary();
});

describe(
  "Local dictionary validation",
  () => {
    it("accepts words found in the locked local lexicon", async () => {
      const accessToken =
        await registerUser(
          "valid-words@example.com"
        );

      const matchId =
        await createMatch(
          accessToken,
          "LOCAL_WORD_LIST"
        );

      await addPlayersAndStart(
        accessToken,
        matchId
      );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${accessToken}`
          )
          .send({
            words: [
              " quiz ",
              "world",
              "SCRABBLE"
            ]
          });

      expect(response.status).toBe(200);

      expect(
        response.body.data.validation
      ).toMatchObject({
        matchId,
        dictionaryPolicy:
          "LOCAL_WORD_LIST",
        accepted: true,
        lexicon: {
          code:
            "LOCAL_STARTER",
          version:
            "1.0.0"
        }
      });

      expect(
        response.body.data.validation
          .words
      ).toEqual([
        {
          submittedWord: "quiz",
          normalizedWord: "QUIZ",
          accepted: true,
          suggestions: []
        },
        {
          submittedWord: "world",
          normalizedWord: "WORLD",
          accepted: true,
          suggestions: []
        },
        {
          submittedWord:
            "SCRABBLE",
          normalizedWord:
            "SCRABBLE",
          accepted: true,
          suggestions: []
        }
      ]);
    });

    it("rejects invalid words and returns suggestions without changing them", async () => {
      const accessToken =
        await registerUser(
          "invalid-words@example.com"
        );

      const matchId =
        await createMatch(
          accessToken,
          "LOCAL_WORD_LIST"
        );

      await addPlayersAndStart(
        accessToken,
        matchId
      );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${accessToken}`
          )
          .send({
            words: [
              "QUIZ",
              "QUZI"
            ]
          });

      expect(response.status).toBe(200);

      const validation =
        response.body.data.validation;

      expect(
        validation.accepted
      ).toBe(false);

      expect(
        validation.words[0]
      ).toMatchObject({
        normalizedWord: "QUIZ",
        accepted: true,
        suggestions: []
      });

      expect(
        validation.words[1]
      ).toMatchObject({
        submittedWord: "QUZI",
        normalizedWord: "QUZI",
        accepted: false
      });

      expect(
        validation.words[1]
          .suggestions
      ).toContain("QUIZ");
    });

    it("rejects validation before the local match has started", async () => {
      const accessToken =
        await registerUser(
          "draft-match@example.com"
        );

      const matchId =
        await createMatch(
          accessToken,
          "LOCAL_WORD_LIST"
        );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${accessToken}`
          )
          .send({
            words: [
              "QUIZ"
            ]
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error.code
      ).toBe(
        "MATCH_NOT_IN_PROGRESS"
      );
    });

    it("rejects policies that require an unconfigured external provider", async () => {
      const accessToken =
        await registerUser(
          "external-policy@example.com"
        );

      const matchId =
        await createMatch(
          accessToken,
          "OXFORD_ONLY"
        );

      await addPlayersAndStart(
        accessToken,
        matchId
      );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${accessToken}`
          )
          .send({
            words: [
              "QUIZ"
            ]
          });

      expect(response.status).toBe(409);

      expect(
        response.body.error.code
      ).toBe(
        "DICTIONARY_POLICY_NOT_AVAILABLE"
      );
    });

    it("does not reveal another user's match", async () => {
      const ownerToken =
        await registerUser(
          "dictionary-owner@example.com"
        );

      const otherToken =
        await registerUser(
          "dictionary-other@example.com"
        );

      const matchId =
        await createMatch(
          ownerToken,
          "LOCAL_WORD_LIST"
        );

      await addPlayersAndStart(
        ownerToken,
        matchId
      );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${otherToken}`
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

    it("rejects unsupported word characters", async () => {
      const accessToken =
        await registerUser(
          "invalid-characters@example.com"
        );

      const matchId =
        await createMatch(
          accessToken,
          "LOCAL_WORD_LIST"
        );

      await addPlayersAndStart(
        accessToken,
        matchId
      );

      const response =
        await request(app)
          .post(
            `/api/v1/matches/${matchId}/dictionary/validate`
          )
          .set(
            "Authorization",
            `Bearer ${accessToken}`
          )
          .send({
            words: [
              "HELLO!"
            ]
          });

      expect(response.status).toBe(400);
    });
  }
);
