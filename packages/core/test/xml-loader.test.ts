import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadXml } from "../src/index.js";

const root = resolve(import.meta.dirname, "../../..");

describe("loadXml", () => {
  it("loads a minimal JMX document", () => {
    const xml = readFileSync(resolve(root, "fixtures/jmx/minimal.jmx"));
    const document = loadXml(xml);

    expect(document.diagnostics).toEqual([]);
    expect(document.root?.name).toBe("jmeterTestPlan");
    expect(document.root?.attributes.version).toBe("1.2");
    expect(document.lineEnding).toBe("lf");
  });

  it("returns malformed XML diagnostics", () => {
    const xml = readFileSync(resolve(root, "fixtures/malformed/not-xml.jmx"));
    const document = loadXml(xml);

    expect(document.diagnostics.some((item) => item.code === "JMX_XML_PARSE_ERROR")).toBe(true);
  });

  it("distinguishes self-closing elements from explicit empty elements", () => {
    const document = loadXml("<root><empty/><expanded></expanded></root>");
    const children = document.root?.children.filter((node) => node.kind === "element") ?? [];

    expect(children[0]?.kind === "element" && children[0].selfClosing).toBe(true);
    expect(children[1]?.kind === "element" && children[1].selfClosing).toBe(false);
  });
});
