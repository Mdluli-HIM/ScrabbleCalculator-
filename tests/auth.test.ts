import request from "supertest";

import {
  beforeEach,
  describe,
  expect,
  it
} from "vitest";

import { app } from "../src/app.js";
import { resetDatabase } from "./helpers/reset-database.js";

const registeredUser = {
  email: "marcus@example.com",
  displayName: "Marcus",
  password: "SecurePassword123"
};

async function registerTestUser() {
  return request(app)
    .post("/api/v1/auth/register")
    .send(registeredUser);
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Registered authentication", () => {
  it("registers a user and retrieves the authenticated profile", async () => {
    const registration =
      await registerTestUser();

    expect(registration.status).toBe(201);

    expect(
      registration.body.data.user
    ).toMatchObject({
      email: "marcus@example.com",
      displayName: "Marcus",
      status: "ACTIVE"
    });

    expect(
      registration.body.data.user.passwordHash
    ).toBeUndefined();

    expect(
      registration.body.data.tokens.accessToken
    ).toEqual(expect.any(String));

    expect(
      registration.body.data.tokens.refreshToken
    ).toEqual(expect.any(String));

    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set(
        "Authorization",
        `Bearer ${registration.body.data.tokens.accessToken}`
      );

    expect(profile.status).toBe(200);

    expect(
      profile.body.data.user
    ).toMatchObject({
      email: "marcus@example.com",
      displayName: "Marcus"
    });
  });

  it("rejects a duplicate email address", async () => {
    await registerTestUser();

    const duplicate =
      await registerTestUser();

    expect(duplicate.status).toBe(409);

    expect(
      duplicate.body.error.code
    ).toBe(
      "EMAIL_ALREADY_REGISTERED"
    );
  });

  it("logs in with valid credentials and rejects an invalid password", async () => {
    await registerTestUser();

    const invalidLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: registeredUser.email,
        password: "WrongPassword123"
      });

    expect(invalidLogin.status).toBe(401);

    expect(
      invalidLogin.body.error.code
    ).toBe("INVALID_CREDENTIALS");

    const validLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: registeredUser.email,
        password: registeredUser.password
      });

    expect(validLogin.status).toBe(200);

    expect(
      validLogin.body.data.tokens.accessToken
    ).toEqual(expect.any(String));

    expect(
      validLogin.body.data.tokens.refreshToken
    ).toEqual(expect.any(String));
  });

  it("rotates refresh tokens and rejects reuse of an old token", async () => {
    const registration =
      await registerTestUser();

    const originalRefreshToken =
      registration.body.data.tokens.refreshToken;

    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .send({
        refreshToken:
          originalRefreshToken
      });

    expect(refreshed.status).toBe(200);

    const newRefreshToken =
      refreshed.body.data.tokens.refreshToken;

    expect(newRefreshToken).not.toBe(
      originalRefreshToken
    );

    const reused = await request(app)
      .post("/api/v1/auth/refresh")
      .send({
        refreshToken:
          originalRefreshToken
      });

    expect(reused.status).toBe(401);

    expect(
      reused.body.error.code
    ).toBe("INVALID_REFRESH_TOKEN");
  });

  it("revokes the session on logout", async () => {
    const registration =
      await registerTestUser();

    const {
      accessToken,
      refreshToken
    } = registration.body.data.tokens;

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .send({
        refreshToken
      });

    expect(logout.status).toBe(200);

    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set(
        "Authorization",
        `Bearer ${accessToken}`
      );

    expect(profile.status).toBe(401);

    expect(
      profile.body.error.code
    ).toBe(
      "AUTHENTICATION_SESSION_INACTIVE"
    );
  });
});
