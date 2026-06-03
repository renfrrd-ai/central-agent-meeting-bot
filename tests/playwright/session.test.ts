import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import { hasSavedSession, sessionFilePath } from "../../src/playwright/session.js";

const dir = mkdtempSync(path.join(tmpdir(), "sessions-"));
const env = loadEnv({ VEXA_API_KEY: "test", PLAYWRIGHT_SESSION_DIR: dir });

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("playwright session store", () => {
  it("builds a per-platform session path", () => {
    expect(sessionFilePath(env, "google_meet")).toBe(path.join(dir, "google_meet.json"));
  });

  it("reports false when no session is saved", () => {
    expect(hasSavedSession(env, "teams")).toBe(false);
  });

  it("reports true once a session file exists", () => {
    writeFileSync(sessionFilePath(env, "google_meet"), "{}");
    expect(hasSavedSession(env, "google_meet")).toBe(true);
  });
});
