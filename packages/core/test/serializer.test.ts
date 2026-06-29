import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadXml, parseHashTreeDocument, serializeJmxDocument, structurallyEquivalentXml } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

function roundTrip(path: string) {
  const originalXml = loadXml(readFileSync(resolve(root, path)));
  const canonical = parseHashTreeDocument(originalXml);
  const serialized = serializeJmxDocument(canonical);
  const reparsedXml = loadXml(serialized);
  return { originalXml, reparsedXml, serialized };
}

describe("JMX serialization", () => {
  it("round-trips minimal JMX structurally", () => {
    const { originalXml, reparsedXml } = roundTrip("fixtures/jmx/minimal.jmx");

    expect(reparsedXml.diagnostics).toEqual([]);
    expect(structurallyEquivalentXml(originalXml.root, reparsedXml.root)).toBe(true);
  });

  it("preserves unknown tags structurally", () => {
    const { originalXml, reparsedXml, serialized } = roundTrip("fixtures/jmx/unknown-tags.jmx");

    expect(serialized).toContain("CustomPlugin");
    expect(serialized).toContain("customProp");
    expect(structurallyEquivalentXml(originalXml.root, reparsedXml.root)).toBe(true);
  });

  it("keeps empty hashTree serialized as empty", () => {
    const { serialized } = roundTrip("fixtures/jmx/minimal.jmx");

    expect(serialized).toContain("<hashTree/>");
  });
});
