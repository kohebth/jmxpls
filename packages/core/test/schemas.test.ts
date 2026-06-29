import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

function readSchema(name: string): unknown {
  return JSON.parse(readFileSync(resolve(root, "schemas", name), "utf8"));
}

describe("shared JSON schemas", () => {
  it("validates diagnostics", () => {
    const ajv = new Ajv2020();
    const validate = ajv.compile(readSchema("diagnostics.schema.json"));

    expect(validate({ code: "JMX_XML_PARSE_ERROR", severity: "fatal", message: "Invalid XML" })).toBe(true);
    expect(validate({ code: "", severity: "bad", message: "" })).toBe(false);
  });

  it("validates semantic patches", () => {
    const ajv = new Ajv2020();
    const validate = ajv.compile(readSchema("semantic-patch.schema.json"));

    expect(
      validate({
        dryRun: true,
        operations: [{ op: "setEnabled", nodeId: "node-1", enabled: false }]
      })
    ).toBe(true);
    expect(validate({ operations: [] })).toBe(false);
  });

  it("validates tool output envelopes", () => {
    const ajv = new Ajv2020();
    ajv.addSchema(readSchema("diagnostics.schema.json"), "diagnostics.schema.json");
    const validate = ajv.compile(readSchema("tool-output.schema.json"));

    expect(validate({ success: true, diagnostics: [], data: { planId: "plan-1" } })).toBe(true);
    expect(validate({ success: true })).toBe(false);
  });
});
