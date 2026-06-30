import type { PlanTemplate, TemplateInput } from "./registry.js";

const LOGIN_THREAD_GROUP = "template-login-bearer-thread-group";
const LOGIN_REQUEST = "template-login-bearer-request";

export const httpApiBaselineTemplate: PlanTemplate = {
  name: "http_api_baseline",
  description: "Baseline HTTP API test plan patch.",
  instantiate: (input = {}) => {
    const idPrefix = stringInput(input, "idPrefix", "template-http-api");
    const threadGroupId = `${idPrefix}-thread-group`;
    const method = stringInput(input, "method", "GET");
    const path = stringInput(input, "path", "/health");
    const port = scalarInput(input, "port");
    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "HTTP API Users"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 10), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)), "LoopController.loops": numberInput(input, "loops", 1) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "requestName", `${method} ${path}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": method, "HTTPSampler.path": path } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ResultCollector", fields: { name: "Summary Report", guiClass: "SummaryReport" } }
      ]
    };
  }
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

function stringInput(input: TemplateInput, key: string, fallback: string): string {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberInput(input: TemplateInput, key: string, fallback: number): number {
  const value = input[key];
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function scalarInput(input: TemplateInput, key: string): string | number | undefined {
  const value = input[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
