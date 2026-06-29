import { describe, expect, it } from "vitest";

import { diagnostic, err, ok, toolFailure, toolSuccess } from "../src/index.js";

describe("shared model helpers", () => {
  it("creates success and failure results", () => {
    expect(ok("value")).toEqual({ ok: true, value: "value" });
    expect(err("problem")).toEqual({ ok: false, error: "problem" });
  });

  it("creates tool result envelopes", () => {
    expect(toolSuccess({ planId: "plan-1" }).success).toBe(true);

    const failure = toolFailure([
      diagnostic({ code: "JMX_TEST", severity: "error", message: "Invalid plan" })
    ]);

    expect(failure.success).toBe(false);
    expect(failure.diagnostics[0]?.code).toBe("JMX_TEST");
  });
});
