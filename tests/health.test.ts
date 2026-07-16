import request from "supertest";
import {
  describe,
  expect,
  it
} from "vitest";

import { app } from "../src/app.js";

describe("ScrabbleCalculator API health", () => {
  it("returns the API health response", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "API is healthy.",

      data: {
        service: "scrabble-calculator-api",
        version: "0.5.0",
        status: "healthy"
      },

      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String)
      }
    });

    expect(response.headers["x-request-id"]).toBeDefined();
  });

  it("returns the standard error response for unknown routes", async () => {
    const response = await request(app)
      .get("/api/v1/unknown-route")
      .expect(404);

    expect(response.body).toMatchObject({
      success: false,

      error: {
        code: "ROUTE_NOT_FOUND"
      },

      meta: {
        requestId: expect.any(String),
        timestamp: expect.any(String)
      }
    });
  });
});
