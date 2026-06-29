import { describe, expect, it } from "vitest";

import { corePackageName } from "../src/index.js";

describe("core package", () => {
  it("exports its package name", () => {
    expect(corePackageName).toBe("@jmxpls/core");
  });
});
