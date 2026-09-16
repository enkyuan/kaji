import { describe, expect, it } from "vitest";

describe("package entry", () => {
  it("exports the public capability API", async () => {
    expect(Object.keys(await import("../src/index.ts")).sort()).toEqual([
      "capability",
      "memoryStore",
    ]);
  });
});
