import { describe, it, expect } from "vitest";
import { matchesGlob, getThrottleFps } from "../utils/glob";

describe("glob utils", () => {
  describe("matchesGlob", () => {
    it("matches exact event", () => {
      expect(matchesGlob("chat:message", "chat:message")).toBe(true);
      expect(matchesGlob("chat:message", "chat:typing")).toBe(false);
    });

    it("matches wildcard *", () => {
      expect(matchesGlob("market:*", "market:tick")).toBe(true);
      expect(matchesGlob("market:*", "market:orderbook")).toBe(true);
      expect(matchesGlob("market:*", "chat:message")).toBe(false);
    });

    it("matches glob patterns", () => {
      expect(matchesGlob("**.js", "foo.js")).toBe(true);
      expect(matchesGlob("foo**", "foobar")).toBe(true);
    });
  });

  describe("getThrottleFps", () => {
    it("returns Infinity for unmatched patterns", () => {
      expect(getThrottleFps({}, "chat:message")).toBe(Infinity);
    });

    it("returns exact match fps", () => {
      expect(getThrottleFps({ "chat:message": 60 }, "chat:message")).toBe(60);
    });

    it("returns minimum fps for multiple matches", () => {
      const config = {
        "market:*": 30,
        "market:tick": 120,
      };
      expect(getThrottleFps(config, "market:tick")).toBe(30); // min of 30 and 120
      expect(getThrottleFps(config, "market:orderbook")).toBe(30);
    });
  });
});
