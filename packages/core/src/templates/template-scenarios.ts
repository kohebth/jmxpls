import type { PlanTemplate, TemplateParameter, TemplateInput } from "./registry.js";
import { numberInput, scalarInput, stringInput } from "./input.js";

const seedThreadGroupParameters: TemplateParameter[] = [
  { name: "idPrefix", type: "string", description: "Node ID prefix for generated elements." },
  { name: "threadGroupName", type: "string", description: "Generated thread group name." },
  { name: "threads", type: "number", description: "Thread group user count." },
  { name: "durationSec", type: "number", description: "Optional scheduled duration in seconds." },
  { name: "rampSec", type: "number", description: "Thread group ramp-up in seconds." },
  { name: "loops", type: "number", description: "Loop count for each thread." }
];

const httpTemplateParameters: TemplateParameter[] = [
  { name: "protocol", type: "string", description: "Default HTTP protocol.", defaultValue: "https" },
  { name: "domain", type: "string", description: "Default HTTP host.", defaultValue: "example.com" },
  { name: "port", type: "stringOrNumber", description: "Optional default HTTP port." }
];

export const blankTestPlanTemplate: PlanTemplate = {
  name: "blank_test_plan",
  description: "Minimal plan scaffold with an empty thread group and result collector.",
  parameters: [...seedThreadGroupParameters, { name: "summaryListenerName", type: "string", description: "Summary report name." }],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-blank")}-thread-group`;
    const port = scalarInput(input, "port");

    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "Blank Plan Users"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 1), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 1)), "LoopController.loops": numberInput(input, "loops", 1) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ResultCollector", fields: { name: stringInput(input, "summaryListenerName", "Summary Report"), guiClass: "SummaryReport" } }
      ]
    };
  }
};

export const crudApiFlowTemplate: PlanTemplate = {
  name: "crud_api_flow",
  description: "CRUD-oriented HTTP flow with create/read/update/delete requests.",
  parameters: [
    ...seedThreadGroupParameters,
    ...httpTemplateParameters,
    { name: "resourceBasePath", type: "string", description: "Base resource path.", defaultValue: "/resources" },
    { name: "resourceIdVariable", type: "string", description: "Resource id variable name.", defaultValue: "resourceId" },
    { name: "createMethod", type: "string", description: "Create request method.", defaultValue: "POST" },
    { name: "readMethod", type: "string", description: "Read request method.", defaultValue: "GET" },
    { name: "updateMethod", type: "string", description: "Update request method.", defaultValue: "PUT" },
    { name: "deleteMethod", type: "string", description: "Delete request method.", defaultValue: "DELETE" },
    { name: "createRequestName", type: "string", description: "Generated create request name." },
    { name: "readRequestName", type: "string", description: "Generated read request name." },
    { name: "updateRequestName", type: "string", description: "Generated update request name." },
    { name: "deleteRequestName", type: "string", description: "Generated delete request name." },
    { name: "createBody", type: "string", description: "Create request body template." },
    { name: "updateBody", type: "string", description: "Update request body template." }
  ],
  instantiate: (input = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-crud-api")}-thread-group`;
    const basePath = stringInput(input, "resourceBasePath", "/resources");
    const idVariable = stringInput(input, "resourceIdVariable", "resourceId");
    const port = scalarInput(input, "port");

    const baseNode = `${threadGroupId}-request`;
    const createPath = `${basePath}`;
    const readPath = `${basePath}/\${${idVariable}}`;
    const updatePath = `${basePath}/\${${idVariable}}`;
    const deletePath = `${basePath}/\${${idVariable}}`;

    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "CRUD API Flow"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 5), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)), "LoopController.loops": numberInput(input, "loops", 1) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: `${baseNode}-create`, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "createRequestName", `${stringInput(input, "createMethod", "POST")} ${createPath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": stringInput(input, "createMethod", "POST"), "HTTPSampler.path": createPath, "HTTPSampler.postBodyRaw": stringInput(input, "createBody", "{\"name\":\"resource\"}") } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: `${baseNode}-read`, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "readRequestName", `${stringInput(input, "readMethod", "GET")} ${readPath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": stringInput(input, "readMethod", "GET"), "HTTPSampler.path": readPath } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: `${baseNode}-update`, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "updateRequestName", `${stringInput(input, "updateMethod", "PUT")} ${updatePath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": stringInput(input, "updateMethod", "PUT"), "HTTPSampler.path": updatePath, "HTTPSampler.postBodyRaw": stringInput(input, "updateBody", "{\"name\":\"resource-updated\"}") } },
        { op: "addNode", parentNodeId: threadGroupId, nodeId: `${baseNode}-delete`, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "deleteRequestName", `${stringInput(input, "deleteMethod", "DELETE")} ${deletePath}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": stringInput(input, "deleteMethod", "DELETE"), "HTTPSampler.path": deletePath } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ResultCollector", fields: { name: "Summary Report", guiClass: "SummaryReport" } }
      ]
    };
  }
};

export const jmeterCiArtifactProfileTemplate: PlanTemplate = {
  name: "jmeter_ci_artifact_profile",
  description: "CI-focused profile with summary metrics and backend-style artifact output.",
  parameters: [
    ...seedThreadGroupParameters,
    ...httpTemplateParameters,
    { name: "backendArguments", type: "string", description: "Backend listener JSON arguments." },
    { name: "backendClassname", type: "string", description: "Backend listener classname.", defaultValue: "org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient" },
    { name: "backendQueueSize", type: "number", description: "Backend listener queue size." },
    { name: "resultFilename", type: "string", description: "Summary collector destination path." }
  ],
  instantiate: (input = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-ci-artifact")}-thread-group`;
    const port = scalarInput(input, "port");
    const backendArguments = stringInput(input, "backendArguments", JSON.stringify({ metric: "jmeter" }));

    return {
      dryRun: true,
      operations: [
        { op: "addNode", parentNodeId: "root", nodeId: threadGroupId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", "CI Artifact Profile"), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", 10), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)), "LoopController.loops": numberInput(input, "loops", 1), "ThreadGroup.scheduler": true, "ThreadGroup.duration": numberInput(input, "durationSec", 300) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "BackendListener", fields: { name: "CI Backend Listener", guiClass: "BackendListenerGui", classname: stringInput(input, "backendClassname", "org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient"), queueSize: numberInput(input, "backendQueueSize", 5000), arguments: backendArguments } },
        { op: "addNode", parentNodeId: threadGroupId, nodeType: "ResultCollector", fields: { name: "Summary Report", guiClass: "SummaryReport", filename: stringInput(input, "resultFilename", "results.jtl") } }
      ]
    };
  }
};
