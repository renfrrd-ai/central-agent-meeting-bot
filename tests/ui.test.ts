import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv, resetEnvCache } from "../src/config/env.js";

const testEnv = loadEnv({
  API_KEY: "test-api-key",
  VEXA_API_KEY: "test-vexa-key",
  VEXA_API_BASE: "https://api.cloud.vexa.ai",
});

describe("Easy Mode UI", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    resetEnvCache();
    app = await buildApp(testEnv);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves index.html at / without API key", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.body).toContain("Send the bot to a meeting");
  });

  it("serves static assets without API key", async () => {
    const response = await app.inject({ method: "GET", url: "/app.js" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/javascript/);
  });
});
