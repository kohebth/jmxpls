import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadXml, parseHashTreeDocument } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

function parseFixture(path: string) {
  return parseHashTreeDocument(loadXml(readFileSync(resolve(root, path))));
}

describe("parseHashTreeDocument", () => {
  it("parses a valid minimal JMX into canonical pairs", () => {
    const document = parseFixture("fixtures/jmx/minimal.jmx");
    const pair = document.root?.hashTree?.pairs[0];

    expect(document.diagnostics).toEqual([]);
    expect(pair?.element.tagName).toBe("TestPlan");
    expect(pair?.element.testClass).toBe("TestPlan");
    expect(pair?.children.pairs).toEqual([]);
  });

  it("reports odd hashTree children", () => {
    const document = parseFixture("fixtures/malformed/odd-hashtree.jmx");

    expect(document.diagnostics.some((item) => item.code === "JMX_HASH_TREE_ODD_CHILDREN")).toBe(true);
    expect(document.diagnostics.some((item) => item.code === "JMX_ELEMENT_WITHOUT_HASHTREE")).toBe(true);
  });

  it("reports orphan hashTree nodes", () => {
    const document = parseFixture("fixtures/malformed/orphan-hashtree.jmx");

    expect(document.diagnostics.some((item) => item.code === "JMX_HASH_TREE_ORPHAN")).toBe(true);
  });
});
