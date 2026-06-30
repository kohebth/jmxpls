import type { PlanTemplate } from "./registry.js";
import { booleanInput, numberInput, scalarInput, stringInput } from "./input.js";

export const csvDrivenLoginFlowTemplate: PlanTemplate = {
  name: "csv_driven_login_flow",
  description: "CSV-driven login flow template.",
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
