import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../src/index.js";

describe("createJmxplsServer", () => {
  it("registers resources, tools, and prompts", () => {
    const server = createJmxplsServer();
    const resources = new Set(server.resources.map((resource) => resource.uriTemplate));

    for (const resource of [
      "jmxpls://plans/{planId}/plan-language/outline",
      "jmxpls://plans/{planId}/diff/xml",
      "jmxpls://catalog",
      "jmxpls://catalog/summary",
      "jmxpls://catalog/types",
      "jmxpls://catalog/types/{type}",
      "jmxpls://runs",
      "jmxpls://runs/{runId}/logs",
      "jmxpls://runs/{runId}/artifacts"
    ]) {
      expect(resources.has(resource)).toBe(true);
    }

    for (const toolName of ["open_plan", "save_plan", "apply_semantic_patch", "add_http_request", "add_csv_data_set", "add_jdbc_sampler", "add_constant_timer", "add_response_assertion", "add_json_extractor", "add_backend_listener", "get_raw_element", "load_component_catalog", "validate_plan", "validate_with_jmeter", "get_jmeter_environment", "run_jmeter", "analyze_jtl", "instantiate_template"]) {
      expect(server.tools.some((tool) => tool.name === toolName)).toBe(true);
    }
    expect(server.prompts.some((prompt) => prompt.name === "jmeter_plan_review")).toBe(true);
  });
});
