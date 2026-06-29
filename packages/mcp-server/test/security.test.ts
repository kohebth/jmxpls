import { describe, expect, it } from "vitest";

import { AuditLog, WorkspaceGuard, redactRecord } from "../src/index.js";

describe("security helpers", () => {
  it("guards workspace paths", () => {
    const guard = new WorkspaceGuard(["/workspace"]);

    expect(guard.allows("/workspace/plan.jmx")).toBe(true);
    expect(guard.allows("/etc/passwd")).toBe(false);
  });

  it("redacts secret-like records and audits actions", () => {
    const audit = new AuditLog();
    audit.record("save", "plan.jmx");

    expect(redactRecord({ password: "secret", host: "example.com" }).password).toBe("<redacted>");
    expect(audit.list()).toHaveLength(1);
  });
});
