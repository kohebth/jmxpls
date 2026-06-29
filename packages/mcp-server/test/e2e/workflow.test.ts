import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../../src/index.js";

describe("MCP workflow surface", () => {
  it("exposes compact inspect, mutate, validate, save, run, and analyze workflow tools", () => {
    const tools = new Set(createJmxplsServer().tools.map((tool) => tool.name));

    for (const name of ["open_plan", "summarize_plan", "get_plan_language", "apply_semantic_patch", "validate_plan", "save_plan", "run_jmeter", "analyze_jtl"]) {
      expect(tools.has(name)).toBe(true);
    }
  });
});
