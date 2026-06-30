import type { PlanTemplate } from "./registry.js";

const CSV_LOGIN_THREAD_GROUP = "template-csv-login-thread-group";
const CSV_LOGIN_REQUEST = "template-csv-login-request";

export const csvDrivenLoginFlowTemplate: PlanTemplate = {
  name: "csv_driven_login_flow",
  description: "CSV-driven login flow template.",
  instantiate: () => ({
    dryRun: true,
    operations: [
      { op: "addNode", parentNodeId: "root", nodeId: CSV_LOGIN_THREAD_GROUP, nodeType: "ThreadGroup", fields: { name: "CSV Login Users", guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": 10, "ThreadGroup.ramp_time": 10, "LoopController.loops": 1 } },
      { op: "addNode", parentNodeId: CSV_LOGIN_THREAD_GROUP, nodeType: "CSVDataSet", fields: { name: "Login Users CSV", guiClass: "TestBeanGUI", filename: "users.csv", variableNames: "username,password", delimiter: ",", ignoreFirstLine: true, recycle: true, stopThread: false, shareMode: "shareMode.all" } },
      { op: "addNode", parentNodeId: CSV_LOGIN_THREAD_GROUP, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": "https", "HTTPSampler.domain": "example.com" } },
      { op: "addNode", parentNodeId: CSV_LOGIN_THREAD_GROUP, nodeId: CSV_LOGIN_REQUEST, nodeType: "HTTPSamplerProxy", fields: { name: "POST /login", guiClass: "HttpTestSampleGui", "HTTPSampler.method": "POST", "HTTPSampler.path": "/login", "HTTPSampler.postBodyRaw": "{\"username\":\"${username}\",\"password\":\"${password}\"}" } },
      { op: "addNode", parentNodeId: CSV_LOGIN_REQUEST, nodeType: "ResponseAssertion", fields: { name: "Login returned 200", guiClass: "AssertionGui", "Assertion.test_field": "Assertion.response_code", "Assertion.test_type": "8", "Assertion.test_strings": "[\"200\"]" } }
    ]
  })
};
