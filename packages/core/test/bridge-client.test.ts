import { describe, expect, it } from "vitest";

import { validateWithJMeter, type BridgeClient } from "../src/index.js";

describe("bridge client integration helpers", () => {
  it("validates JMX through the typed bridge client method", async () => {
    const calls: string[] = [];
    const bridge = {
      validateJmx: async (path: string) => {
        calls.push(path);
        return { id: "validation", success: true, data: { path, valid: true }, diagnostics: [] };
      }
    } as unknown as BridgeClient;

    const result = await validateWithJMeter(bridge, { path: "plan.jmx", mode: "loadSaveReload" });

    expect(calls).toEqual(["plan.jmx"]);
    expect(result.valid).toBe(true);
    expect(result.mode).toBe("loadSaveReload");
  });

  it("reports invalid when the bridge response is not successful", async () => {
    const bridge = {
      validateJmx: async (path: string) => ({
        id: "validation",
        success: false,
        data: { path, valid: true },
        diagnostics: [{ code: "JMX_BRIDGE_ERROR", severity: "error", message: "Bridge failed" }]
      })
    } as unknown as BridgeClient;

    const result = await validateWithJMeter(bridge, { path: "plan.jmx", mode: "load" });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("JMX_BRIDGE_ERROR");
  });
});
