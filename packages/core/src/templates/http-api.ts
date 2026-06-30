import type { PlanTemplate } from "./registry.js";
import { numberInput, scalarInput, stringInput } from "./input.js";

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
  instantiate: (input = {}) => {
    const idPrefix = stringInput(input, "idPrefix", "template-login-bearer");
    const threadGroupId = `${idPrefix}-thread-group`;
    const loginRequestId = `${idPrefix}-request`;
    const loginMethod = stringInput(input, "loginMethod", "POST");
    const loginPath = stringInput(input, "loginPath", "/login");
    const authenticatedMethod = stringInput(input, "authenticatedMethod", "GET");
    const authenticatedPath = stringInput(input, "authenticatedPath", "/profile");
    const usernameVariable = stringInput(input, "usernameVariable", "username");
    const passwordVariable = stringInput(input, "passwordVariable", "password");
    const tokenVariable = stringInput(input, "tokenVariable", "authToken");
    const port = scalarInput(input, "port");
    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "Bearer Token Users"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 10), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)), "LoopController.loops": numberInput(input, "loops", 1) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: loginRequestId, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "loginRequestName", `${loginMethod} ${loginPath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": loginMethod, "HTTPSampler.path": loginPath, "HTTPSampler.postBodyRaw": stringInput(input, "loginBody", `{"username":"\${${usernameVariable}}","password":"\${${passwordVariable}}"}`) } },
        { op: "addNode", parentNodeId: loginRequestId, nodeType: "JSONPostProcessor", fields: { name: "Extract bearer token", guiClass: "JSONPostProcessorGui", "JSONPostProcessor.referenceNames": tokenVariable, "JSONPostProcessor.jsonPathExprs": stringInput(input, "tokenJsonPath", "$.token"), "JSONPostProcessor.match_numbers": 1, "JSONPostProcessor.defaultValues": stringInput(input, "tokenDefault", "TOKEN_NOT_FOUND"), "JSONPostProcessor.compute_concat": false } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "HeaderManager", fields: { name: "Bearer Authorization", guiClass: "HeaderPanel", "HeaderManager.headers": JSON.stringify({ [stringInput(input, "authHeaderName", "Authorization")]: `${stringInput(input, "authHeaderPrefix", "Bearer")} \${${tokenVariable}}` }) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "authenticatedRequestName", `${authenticatedMethod} ${authenticatedPath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": authenticatedMethod, "HTTPSampler.path": authenticatedPath } }
      ]
    };
  }
};
