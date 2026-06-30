import type { PlanTemplate } from "./registry.js";

const BASELINE_THREAD_GROUP = "template-http-api-thread-group";

export const httpApiBaselineTemplate: PlanTemplate = {
  name: "http_api_baseline",
  description: "Baseline HTTP API test plan patch.",
  instantiate: () => ({
    dryRun: true,
    operations: [
      { op: "addNode", parentNodeId: "root", nodeId: BASELINE_THREAD_GROUP, nodeType: "ThreadGroup", fields: { name: "HTTP API Users", guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": 10, "ThreadGroup.ramp_time": 10, "LoopController.loops": 1 } },
      { op: "addNode", parentNodeId: BASELINE_THREAD_GROUP, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": "https", "HTTPSampler.domain": "example.com" } },
      { op: "addNode", parentNodeId: BASELINE_THREAD_GROUP, nodeType: "HTTPSamplerProxy", fields: { name: "GET /health", guiClass: "HttpTestSampleGui", "HTTPSampler.method": "GET", "HTTPSampler.path": "/health" } },
      { op: "addNode", parentNodeId: BASELINE_THREAD_GROUP, nodeType: "ResultCollector", fields: { name: "Summary Report", guiClass: "SummaryReport" } }
    ]
  })
};

export const httpApiLoginBearerTokenTemplate: PlanTemplate = {
  name: "http_api_login_bearer_token",
  description: "HTTP API login flow with bearer token extraction.",
  instantiate: () => ({ dryRun: true, operations: [] })
};
