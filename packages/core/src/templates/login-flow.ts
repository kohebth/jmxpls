import type { PlanTemplate, TemplateParameter } from "./registry.js";
import { booleanInput, numberInput, scalarInput, stringInput } from "./input.js";

const csvLoginParameters: TemplateParameter[] = [
  { name: "idPrefix", type: "string", description: "Node ID prefix for generated elements.", defaultValue: "template-csv-login" },
  { name: "domain", type: "string", description: "Default HTTP host.", defaultValue: "example.com" },
  { name: "protocol", type: "string", description: "Default HTTP protocol.", defaultValue: "https" },
  { name: "port", type: "stringOrNumber", description: "Optional default HTTP port." },
  { name: "threads", type: "number", description: "Thread group user count.", defaultValue: 10 },
  { name: "rampSec", type: "number", description: "Thread group ramp-up in seconds.", defaultValue: 10 },
  { name: "loops", type: "number", description: "Loop count for each thread.", defaultValue: 1 },
  { name: "threadGroupName", type: "string", description: "Generated thread group name.", defaultValue: "CSV Login Users" },
  { name: "csvFilename", type: "string", description: "CSV file path for login users.", defaultValue: "users.csv" },
  { name: "variableNames", type: "string", description: "CSV variable names in JMeter order.", defaultValue: "username,password" },
  { name: "delimiter", type: "string", description: "CSV delimiter.", defaultValue: "," },
  { name: "ignoreFirstLine", type: "boolean", description: "Whether to ignore the first CSV row.", defaultValue: true },
  { name: "recycle", type: "boolean", description: "Whether to recycle CSV rows.", defaultValue: true },
  { name: "stopThread", type: "boolean", description: "Whether to stop threads at EOF.", defaultValue: false },
  { name: "shareMode", type: "string", description: "CSV sharing mode.", defaultValue: "shareMode.all" },
  { name: "loginPath", type: "string", description: "Login request path.", defaultValue: "/login" },
  { name: "loginMethod", type: "string", description: "Login request method.", defaultValue: "POST" },
  { name: "loginBody", type: "string", description: "Login request body template." },
  { name: "loginRequestName", type: "string", description: "Generated login request name." },
  { name: "usernameVariable", type: "string", description: "Username variable referenced in the login body.", defaultValue: "username" },
  { name: "passwordVariable", type: "string", description: "Password variable referenced in the login body.", defaultValue: "password" },
  { name: "expectedStatus", type: "string", description: "Expected login response code.", defaultValue: "200" }
];

export const csvDrivenLoginFlowTemplate: PlanTemplate = {
  name: "csv_driven_login_flow",
  description: "CSV-driven login flow template.",
  parameters: csvLoginParameters,
  instantiate: (input = {}) => {
    const idPrefix = stringInput(input, "idPrefix", "template-csv-login");
    const threadGroupId = `${idPrefix}-thread-group`;
    const loginRequestId = `${idPrefix}-request`;
    const loginMethod = stringInput(input, "loginMethod", "POST");
    const loginPath = stringInput(input, "loginPath", "/login");
    const usernameVariable = stringInput(input, "usernameVariable", "username");
    const passwordVariable = stringInput(input, "passwordVariable", "password");
    const port = scalarInput(input, "port");
    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "CSV Login Users"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 10), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)), "LoopController.loops": numberInput(input, "loops", 1) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "CSVDataSet", fields: { name: "Login Users CSV", guiClass: "TestBeanGUI", filename: stringInput(input, "csvFilename", "users.csv"), variableNames: stringInput(input, "variableNames", `${usernameVariable},${passwordVariable}`), delimiter: stringInput(input, "delimiter", ","), ignoreFirstLine: booleanInput(input, "ignoreFirstLine", true), recycle: booleanInput(input, "recycle", true), stopThread: booleanInput(input, "stopThread", false), shareMode: stringInput(input, "shareMode", "shareMode.all") } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: loginRequestId, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "loginRequestName", `${loginMethod} ${loginPath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": loginMethod, "HTTPSampler.path": loginPath, "HTTPSampler.postBodyRaw": stringInput(input, "loginBody", `{"username":"\${${usernameVariable}}","password":"\${${passwordVariable}}"}`) } },
        { op: "addNode", parentNodeId: loginRequestId, nodeType: "ResponseAssertion", fields: { name: "Login returned 200", guiClass: "AssertionGui", "Assertion.test_field": "Assertion.response_code", "Assertion.test_type": "8", "Assertion.test_strings": JSON.stringify([stringInput(input, "expectedStatus", "200")]) } }
      ]
    };
  }
};
