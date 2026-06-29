import { describe, expect, it } from "vitest";

import { createBuiltInComponentRegistry } from "../src/index.js";

describe("ComponentRegistry", () => {
  it("looks up structural, HTTP, data, and extended component descriptors", () => {
    const registry = createBuiltInComponentRegistry();

    expect(registry.lookup({ testClass: "TestPlan" })?.descriptor.role).toBe("testPlan");
    expect(registry.lookup({ testClass: "HTTPSamplerProxy" })?.descriptor.role).toBe("sampler");
    expect(registry.lookup({ testClass: "CSVDataSet" })?.descriptor.role).toBe("config");
    expect(registry.lookup({ testClass: "JDBCSampler" })?.descriptor.role).toBe("sampler");
    expect(registry.lookup({ testClass: "ConstantTimer" })?.descriptor.role).toBe("timer");
    expect(registry.lookup({ testClass: "ResponseAssertion" })?.descriptor.role).toBe("assertion");
    expect(registry.lookup({ testClass: "RegexExtractor" })?.descriptor.role).toBe("extractor");
    expect(registry.lookup({ testClass: "ResultCollector" })?.descriptor.role).toBe("listener");
    expect(registry.descriptors().length).toBeGreaterThan(50);
  });
});
