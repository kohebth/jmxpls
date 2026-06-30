import type { PlanTemplate } from "./registry.js";

const BASELINE_THREAD_GROUP = "template-http-api-thread-group";
const LOGIN_THREAD_GROUP = "template-login-bearer-thread-group";
const LOGIN_REQUEST = "template-login-bearer-request";

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
  instantiate: () => ({
    dryRun: true,
    operations: [
      { op: "addNode", parentNodeId: "root", nodeId: LOGIN_THREAD_GROUP, nodeType: "ThreadGroup", fields: { name: "Bearer Token Users", guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": 10, "ThreadGroup.ramp_time": 10, "LoopController.loops": 1 } },
      { op: "addNode", parentNodeId: LOGIN_THREAD_GROUP, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": "https", "HTTPSampler.domain": "example.com" } },
      { op: "addNode", parentNodeId: LOGIN_THREAD_GROUP, nodeId: LOGIN_REQUEST, nodeType: "HTTPSamplerProxy", fields: { name: "POST /login", guiClass: "HttpTestSampleGui", "HTTPSampler.method": "POST", "HTTPSampler.path": "/login", "HTTPSampler.postBodyRaw": "{\"username\":\"${username}\",\"password\":\"${password}\"}" } },
      { op: "addNode", parentNodeId: LOGIN_REQUEST, nodeType: "JSONPostProcessor", fields: { name: "Extract bearer token", guiClass: "JSONPostProcessorGui", "JSONPostProcessor.referenceNames": "authToken", "JSONPostProcessor.jsonPathExprs": "$.token", "JSONPostProcessor.match_numbers": 1, "JSONPostProcessor.defaultValues": "TOKEN_NOT_FOUND", "JSONPostProcessor.compute_concat": false } },
      { op: "addNode", parentNodeId: LOGIN_THREAD_GROUP, nodeType: "HeaderManager", fields: { name: "Bearer Authorization", guiClass: "HeaderPanel", "HeaderManager.headers": "{\"Authorization\":\"Bearer ${authToken}\"}" } },
      { op: "addNode", parentNodeId: LOGIN_THREAD_GROUP, nodeType: "HTTPSamplerProxy", fields: { name: "GET /profile", guiClass: "HttpTestSampleGui", "HTTPSampler.method": "GET", "HTTPSampler.path": "/profile" } }
    ]
  })
};
