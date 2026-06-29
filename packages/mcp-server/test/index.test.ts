import { describe, expect, it } from "vitest";

import { serverPackageName } from "../src/index.js";

describe("mcp-server package", () => {
  it("exports its package name", () => {
    expect(serverPackageName).toBe("@jmxpls/mcp-server");
  });
});
