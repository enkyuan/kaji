import { describe, expect, it } from "vitest";

describe("package entry", () => {
  it("imports with no product exports", async () => {
    expect(Object.keys(await import("../src/index.ts"))).toEqual([]);
  });
});
