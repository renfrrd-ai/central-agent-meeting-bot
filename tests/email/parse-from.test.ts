import { describe, expect, it } from "vitest";
import { parseEmailAddress } from "../../src/email/parse-from.js";

describe("parseEmailAddress", () => {
  it("parses angle-bracket format", () => {
    expect(parseEmailAddress("Alice <alice@example.com>")).toBe("alice@example.com");
  });

  it("lowercases bare address", () => {
    expect(parseEmailAddress("Bob@Example.COM")).toBe("bob@example.com");
  });
});
