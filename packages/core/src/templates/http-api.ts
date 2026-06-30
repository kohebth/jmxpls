import type { PlanTemplate, TemplateParameter } from "./registry.js";
import { numberInput, scalarInput, stringInput } from "./input.js";

const commonHttpParameters: TemplateParameter[] = [
  { name: "idPrefix", type: "string", description: "Node ID prefix for generated elements." },
  { name: "domain", type: "string", description: "Default HTTP host.", defaultValue: "example.com" },
  { name: "protocol", type: "string", description: "Default HTTP protocol.", defaultValue: "https" },
  { name: "port", type: "stringOrNumber", description: "Optional default HTTP port." },
  { name: "threads", type: "number", description: "Thread group user count.", defaultValue: 10 },
  { name: "rampSec", type: "number", description: "Thread group ramp-up in seconds.", defaultValue: 10 },
  { name: "loops", type: "number", description: "Loop count for each thread.", defaultValue: 1 },
  { name: "threadGroupName", type: "string", description: "Generated thread group name." }
];

export const httpApiBaselineTemplate: PlanTemplate = {
  name: "http_api_baseline",
  description: "Baseline HTTP API test plan patch.",
  parameters: [
    ...commonHttpParameters.map((parameter) => parameter.name === "idPrefix" ? { ...parameter, defaultValue: "template-http-api" } : parameter),
    { name: "path", type: "string", description: "Sample request path.", defaultValue: "/health" },
    { name: "method", type: "string", description: "Sample request method.", defaultValue: "GET" },
    { name: "requestName", type: "string", description: "Generated sample request name." }
  ],
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
  parameters: [
    ...commonHttpParameters.map((parameter) => parameter.name === "idPrefix" ? { ...parameter, defaultValue: "template-login-bearer" } : parameter),
    { name: "loginPath", type: "string", description: "Login request path.", defaultValue: "/login" },
    { name: "loginMethod", type: "string", description: "Login request method.", defaultValue: "POST" },
    { name: "loginBody", type: "string", description: "Login request body template." },
    { name: "loginRequestName", type: "string", description: "Generated login request name." },
    { name: "authenticatedPath", type: "string", description: "Authenticated sample request path.", defaultValue: "/profile" },
    { name: "authenticatedMethod", type: "string", description: "Authenticated sample request method.", defaultValue: "GET" },
    { name: "authenticatedRequestName", type: "string", description: "Generated authenticated request name." },
    { name: "usernameVariable", type: "string", description: "Username variable referenced in the login body.", defaultValue: "username" },
    { name: "passwordVariable", type: "string", description: "Password variable referenced in the login body.", defaultValue: "password" },
    { name: "tokenVariable", type: "string", description: "JMeter variable that stores the extracted token.", defaultValue: "authToken" },
    { name: "tokenJsonPath", type: "string", description: "JSONPath expression used to extract the token.", defaultValue: "$.token" },
    { name: "tokenDefault", type: "string", description: "Default value when token extraction fails.", defaultValue: "TOKEN_NOT_FOUND" },
    { name: "authHeaderName", type: "string", description: "Authorization header name.", defaultValue: "Authorization" },
    { name: "authHeaderPrefix", type: "string", description: "Authorization header value prefix.", defaultValue: "Bearer" }
  ],
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
