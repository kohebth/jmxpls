import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSemanticPlan, loadBuiltInCatalog, loadXml, mergeCatalogs, parseHashTreeDocument, validatePlan, validateRawPatch } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("validation and catalog", () => {
  it("validates minimal plans without blocking errors", () => {
    const canonical = parseHashTreeDocument(loadXml(readFileSync(resolve(root, "fixtures/jmx/minimal.jmx"))));
    const semantic = buildSemanticPlan(canonical);
    const result = validatePlan(canonical, semantic);

    expect(result.valid).toBe(true);
  });

  it("reports unknown plugin components with actionable recovery guidance", () => {
    const canonical = parseHashTreeDocument(loadXml(readFileSync(resolve(root, "fixtures/plugins/unknown-plugin.jmx"))));
    const semantic = buildSemanticPlan(canonical);
    const result = validatePlan(canonical, semantic);

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "JMX_UNKNOWN_COMPONENT",
      severity: "info",
      message: expect.stringContaining("com.example.UnknownPlugin"),
      fixSuggestion: expect.stringContaining("plugin jar")
    }));
  });

  it("validates raw XML patches", () => {
    expect(validateRawPatch({ nodeId: "node-1", propertyPath: "x", xmlFragment: "<stringProp/>" })).toEqual([]);
    expect(validateRawPatch({ nodeId: "node-1", propertyPath: "x", xmlFragment: "<stringProp>" }).length).toBeGreaterThan(0);
  });

  it("loads and merges catalogs", () => {
    const catalog = loadBuiltInCatalog();
    const merged = mergeCatalogs(catalog, { version: 1, source: "dynamic", components: [] });

    expect(merged.source).toBe("merged");
    expect(merged.components.length).toBe(catalog.components.length);
  });
});
