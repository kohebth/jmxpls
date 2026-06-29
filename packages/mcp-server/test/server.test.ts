import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../src/index.js";

describe("createJmxplsServer", () => {
  it("registers resources, tools, and prompts", () => {
    const server = createJmxplsServer();

    expect(server.resources.some((resource) => resource.uriTemplate.includes("plan-language"))).toBe(true);
    expect(server.resources.some((resource) => resource.uriTemplate.includes("diff/xml"))).toBe(true);
    for (const toolName of ["open_plan", "save_plan", "apply_semantic_patch", "add_http_request", "add_csv_data_set", "add_jdbc_sampler", "add_constant_timer", "add_response_assertion", "add_json_extractor", "add_backend_listener", "get_raw_element", "load_component_catalog", "validate_plan", "validate_with_jmeter", "run_jmeter", "analyze_jtl", "instantiate_template"]) {
      expect(server.tools.some((tool) => tool.name === toolName)).toBe(true);
    }
    expect(server.prompts.some((prompt) => prompt.name === "jmeter_plan_review")).toBe(true);
  });
});
