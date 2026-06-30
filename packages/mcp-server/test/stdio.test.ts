import { describe, expect, it } from "vitest";

import { resolvePromptTemplate } from "../src/transports/stdio.js";

describe("stdio prompt helpers", () => {
  it("renders prompt templates with arguments", () => {
    const rendered = resolvePromptTemplate("Use plan {{planId}} and path {{planPath}}", { planId: "abc", planPath: "/tmp/plan.jmx" });
    expect(rendered).toBe("Use plan abc and path /tmp/plan.jmx");
  });

  it("keeps placeholders when not provided", () => {
    const rendered = resolvePromptTemplate("Template {{missing}} remains", {});
    expect(rendered).toBe("Template {{missing}} remains");
  });
});

