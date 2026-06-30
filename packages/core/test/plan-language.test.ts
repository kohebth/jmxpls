import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSemanticPlan, loadXml, parseHashTreeDocument, parsePlanLanguage, projectPlanLanguage, roundTripPlanLanguage, serializePlanLanguage } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

function semanticPlan() {
  return buildSemanticPlan(parseHashTreeDocument(loadXml(readFileSync(resolve(root, "fixtures/jmx/minimal.jmx")))));
}

describe("Plan Language", () => {
  it("projects outline and full modes", () => {
    const plan = semanticPlan();

    expect(projectPlanLanguage(plan).mode).toBe("outline");
    expect(projectPlanLanguage(plan, { mode: "full" }).nodes[0]?.rawRef).toBeTruthy();
  });

  it("serializes and parses JSON", () => {
    const document = projectPlanLanguage(semanticPlan(), { mode: "semantic" });
    const parsed = parsePlanLanguage(serializePlanLanguage(document, "json"));

    expect(parsed.sourceFormat).toBe("json");
    expect(parsed.document.name).toBe("Minimal Plan");
  });

  it("parses YAML", () => {
    const document = projectPlanLanguage(semanticPlan(), { mode: "semantic" });
    const parsed = parsePlanLanguage(serializePlanLanguage(document, "yaml"));

    expect(parsed.sourceFormat).toBe("yaml");
    expect(parsed.document.name).toBe("Minimal Plan");
  });

  it("round-trips through JSON", () => {
    expect(roundTripPlanLanguage(semanticPlan()).equivalent).toBe(true);
  });
});
