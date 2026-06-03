import { describe, expect, it } from "vitest";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import { isSenderAllowed, parseEmailAddress } from "../../src/email/sender-allowlist.js";

describe("parseEmailAddress", () => {
  it("parses angle-bracket format", () => {
    expect(parseEmailAddress("Alice <alice@example.com>")).toBe("alice@example.com");
  });

  it("lowercases bare address", () => {
    expect(parseEmailAddress("Bob@Example.COM")).toBe("bob@example.com");
  });
});

describe("isSenderAllowed", () => {
  it("allows all senders in open mode", () => {
    resetEnvCache();
    const env = loadEnv({
      VEXA_API_KEY: "k",
      INVITE_SENDER_MODE: "open",
    });
    expect(isSenderAllowed("anyone@example.com", env)).toBe(true);
  });

  it("strict mode allows only listed senders", () => {
    resetEnvCache();
    const env = loadEnv({
      VEXA_API_KEY: "k",
      INVITE_SENDER_MODE: "strict",
      ALLOWED_INVITE_SENDERS: "trainer@school.edu",
    });
    expect(isSenderAllowed("trainer@school.edu", env)).toBe(true);
    expect(isSenderAllowed("Trainer <trainer@school.edu>", env)).toBe(true);
    expect(isSenderAllowed("other@example.com", env)).toBe(false);
  });

  it("domain mode allows matching domains", () => {
    resetEnvCache();
    const env = loadEnv({
      VEXA_API_KEY: "k",
      INVITE_SENDER_MODE: "domain",
      ALLOWED_INVITE_DOMAINS: "school.edu",
    });
    expect(isSenderAllowed("student@school.edu", env)).toBe(true);
    expect(isSenderAllowed("guest@gmail.com", env)).toBe(false);
  });
});
