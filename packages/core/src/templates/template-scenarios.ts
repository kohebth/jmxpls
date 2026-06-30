import type { PlanTemplate, TemplateInput, TemplateParameter } from "./registry.js";
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

const templateBackends = {
  influxdb: {
    defaults: {
      influxdbUrl: "http://localhost:8086",
      influxdbName: "jmeter",
      influxdbMeasurement: "jmeter",
      backendClassname: "org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient"
    },
    fields: ["influxdbUrl", "influxdbName", "influxdbMeasurement"]
  } as const
};

export const blankTestPlanTemplate: PlanTemplate = {
  name: "blank_test_plan",
  description: "Minimal plan scaffold with an empty thread group and result collector.",
  parameters: [...seedThreadGroupParameters, ...httpTemplateParameters, { name: "summaryListenerName", type: "string", description: "Summary report name." }],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-blank")}-thread-group`;
    const port = scalarInput(input, "port");

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "Blank Plan Users"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 1),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 1)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ConfigTestElement",
          fields: {
            name: "HTTP Request Defaults",
            guiClass: "HttpDefaultsGui",
            "HTTPSampler.protocol": stringInput(input, "protocol", "https"),
            "HTTPSampler.domain": stringInput(input, "domain", "example.com"),
            ...(port !== undefined ? { "HTTPSampler.port": port } : {})
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: {
            name: stringInput(input, "summaryListenerName", "Summary Report"),
            guiClass: "SummaryReport"
          }
        }
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
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-crud-api")}-thread-group`;
    const basePath = stringInput(input, "resourceBasePath", "/resources");
    const idVariable = stringInput(input, "resourceIdVariable", "resourceId");
    const port = scalarInput(input, "port");
    const createMethod = stringInput(input, "createMethod", "POST");
    const readMethod = stringInput(input, "readMethod", "GET");
    const updateMethod = stringInput(input, "updateMethod", "PUT");
    const deleteMethod = stringInput(input, "deleteMethod", "DELETE");
    const createPath = `${basePath}`;
    const readPath = `${basePath}/\${${idVariable}}`;
    const baseNodeId = `${stringInput(input, "idPrefix", "template-crud-api")}-request`;

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "CRUD API Flow"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 5),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ConfigTestElement",
          fields: {
            name: "HTTP Request Defaults",
            guiClass: "HttpDefaultsGui",
            "HTTPSampler.protocol": stringInput(input, "protocol", "https"),
            "HTTPSampler.domain": stringInput(input, "domain", "example.com"),
            ...(port !== undefined ? { "HTTPSampler.port": port } : {})
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeId: `${baseNodeId}-create`,
          nodeType: "HTTPSamplerProxy",
          fields: {
            name: stringInput(input, "createRequestName", `${createMethod} ${createPath}`),
            guiClass: "HttpTestSampleGui",
            "HTTPSampler.method": createMethod,
            "HTTPSampler.path": createPath,
            "HTTPSampler.postBodyRaw": stringInput(input, "createBody", "{\"name\":\"resource\"}")
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeId: `${baseNodeId}-read`,
          nodeType: "HTTPSamplerProxy",
          fields: {
            name: stringInput(input, "readRequestName", `${readMethod} ${readPath}`),
            guiClass: "HttpTestSampleGui",
            "HTTPSampler.method": readMethod,
            "HTTPSampler.path": readPath
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeId: `${baseNodeId}-update`,
          nodeType: "HTTPSamplerProxy",
          fields: {
            name: stringInput(input, "updateRequestName", `${updateMethod} ${readPath}`),
            guiClass: "HttpTestSampleGui",
            "HTTPSampler.method": updateMethod,
            "HTTPSampler.path": readPath,
            "HTTPSampler.postBodyRaw": stringInput(input, "updateBody", "{\"name\":\"resource-updated\"}")
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeId: `${baseNodeId}-delete`,
          nodeType: "HTTPSamplerProxy",
          fields: {
            name: stringInput(input, "deleteRequestName", `${deleteMethod} ${readPath}`),
            guiClass: "HttpTestSampleGui",
            "HTTPSampler.method": deleteMethod,
            "HTTPSampler.path": readPath
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: { name: "Summary Report", guiClass: "SummaryReport" }
        }
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
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-ci-artifact")}-thread-group`;
    const port = scalarInput(input, "port");
    const argumentsValue = stringInput(input, "backendArguments", JSON.stringify({ metric: "jmeter" }));

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "CI Artifact Profile"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 10),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 10)),
            "LoopController.loops": numberInput(input, "loops", 1),
            "ThreadGroup.scheduler": true,
            "ThreadGroup.duration": numberInput(input, "durationSec", 300)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ConfigTestElement",
          fields: {
            name: "HTTP Request Defaults",
            guiClass: "HttpDefaultsGui",
            "HTTPSampler.protocol": stringInput(input, "protocol", "https"),
            "HTTPSampler.domain": stringInput(input, "domain", "example.com"),
            ...(port !== undefined ? { "HTTPSampler.port": port } : {})
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "BackendListener",
          fields: {
            name: "CI Backend Listener",
            guiClass: "BackendListenerGui",
            classname: stringInput(input, "backendClassname", "org.apache.jmeter.visualizers.backend.influxdb.InfluxdbBackendListenerClient"),
            queueSize: numberInput(input, "backendQueueSize", 5000),
            arguments: argumentsValue
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: {
            name: "Summary Report",
            guiClass: "SummaryReport",
            filename: stringInput(input, "resultFilename", "results.jtl")
          }
        }
      ]
    };
  }
};

export const backendListenerInfluxDbProfileTemplate: PlanTemplate = {
  name: "backend_listener_influxdb_profile",
  description: "InfluxDB-oriented backend listener profile for load-test observability.",
  parameters: [
    ...seedThreadGroupParameters,
    { name: "backendArguments", type: "string", description: "Backend listener JSON arguments." },
    { name: "backendQueueSize", type: "number", description: "Backend listener queue size." },
    { name: "influxdbUrl", type: "string", description: "InfluxDB endpoint URL." },
    { name: "influxdbName", type: "string", description: "InfluxDB database or bucket name." },
    { name: "influxdbMeasurement", type: "string", description: "InfluxDB measurement name." },
    { name: "backendClassname", type: "string", description: "Backend listener classname.", defaultValue: templateBackends.influxdb.defaults.backendClassname }
  ],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-influx")}-thread-group`;
    const args = {
      influxdbUrl: stringInput(input, "influxdbUrl", templateBackends.influxdb.defaults.influxdbUrl),
      influxdbName: stringInput(input, "influxdbName", templateBackends.influxdb.defaults.influxdbName),
      measurement: stringInput(input, "influxdbMeasurement", templateBackends.influxdb.defaults.influxdbMeasurement)
    };

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "InfluxDB Profile"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 25),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 5)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "BackendListener",
          fields: {
            name: "InfluxDB Backend Listener",
            guiClass: "BackendListenerGui",
            classname: stringInput(input, "backendClassname", templateBackends.influxdb.defaults.backendClassname),
            queueSize: numberInput(input, "backendQueueSize", 10000),
            arguments: stringInput(input, "backendArguments", JSON.stringify(args))
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: { name: "Summary Report", guiClass: "SummaryReport" }
        }
      ]
    };
  }
};

export const jdbcQueryTestTemplate: PlanTemplate = {
  name: "jdbc_query_test",
  description: "Simple JDBC template with source and query.",
  parameters: [
    ...seedThreadGroupParameters,
    { name: "dataSource", type: "string", description: "JDBC datasource name.", defaultValue: "main" },
    { name: "dbUrl", type: "string", description: "JDBC database URL.", defaultValue: "jdbc:h2:mem:sample" },
    { name: "driver", type: "string", description: "JDBC driver class name." },
    { name: "username", type: "string", description: "Database username." },
    { name: "password", type: "string", description: "Database password." },
    { name: "query", type: "string", description: "SQL query to execute.", defaultValue: "SELECT 1" }
  ],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-jdbc")}-thread-group`;

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "JDBC Query Flow"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 1),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 3)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "JDBCDataSource",
          fields: {
            name: "JDBC Data Source",
            guiClass: "TestBeanGUI",
            dataSource: stringInput(input, "dataSource", "main"),
            dbUrl: stringInput(input, "dbUrl", "jdbc:h2:mem:sample"),
            driver: stringInput(input, "driver", "org.h2.Driver"),
            username: stringInput(input, "username", "sa"),
            password: stringInput(input, "password", "")
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "JDBCSampler",
          fields: {
            name: "JDBC Query",
            guiClass: "TestBeanGUI",
            dataSource: stringInput(input, "dataSource", "main"),
            queryType: "Select Statement",
            query: stringInput(input, "query", "SELECT 1"),
            queryArguments: "",
            variableNames: ""
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResponseAssertion",
          fields: {
            name: "JDBC returned data",
            guiClass: "AssertionGui",
            "Assertion.test_field": "Assertion.response_data",
            "Assertion.test_type": "16",
            "Assertion.test_strings": JSON.stringify(["1"]),
            "Assertion.invert": false
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: { name: "Summary Report", guiClass: "SummaryReport" }
        }
      ]
    };
  }
};

export const jmsPointToPointTestTemplate: PlanTemplate = {
  name: "jms_point_to_point_test",
  description: "JMS point-to-point test with a single message sampler.",
  parameters: [
    ...seedThreadGroupParameters,
    { name: "destination", type: "string", description: "JMS destination.", defaultValue: "test.queue" },
    { name: "providerUrl", type: "string", description: "JMS provider URL." },
    { name: "message", type: "string", description: "JMS message payload.", defaultValue: "hello" }
  ],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-jms")}-thread-group`;

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "JMS Point-to-Point"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 10),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 5)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "JMSSampler",
          fields: {
            name: "Send JMS",
            guiClass: "JmsSamplerGui",
            "JMSSampler.destination": stringInput(input, "destination", "test.queue"),
            "JMSSampler.providerUrl": stringInput(input, "providerUrl", ""),
            "JMSSampler.message": stringInput(input, "message", "hello")
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: { name: "Summary Report", guiClass: "SummaryReport" }
        }
      ]
    };
  }
};

export const tcpSmokeTestTemplate: PlanTemplate = {
  name: "tcp_smoke_test",
  description: "TCP sampler smoke test template.",
  parameters: [
    ...seedThreadGroupParameters,
    { name: "server", type: "string", description: "TCP server host.", defaultValue: "localhost" },
    { name: "text", type: "string", description: "TCP request payload.", defaultValue: "ping" },
    { name: "timeout", type: "number", description: "TCP timeout value.", defaultValue: 5000 }
  ],
  instantiate: (input: TemplateInput = {}) => {
    const threadGroupId = `${stringInput(input, "idPrefix", "template-tcp")}-thread-group`;
    const port = scalarInput(input, "port");

    return {
      dryRun: true,
      operations: [
        {
          op: "addNode",
          parentNodeId: "root",
          nodeId: threadGroupId,
          nodeType: "ThreadGroup",
          fields: {
            name: stringInput(input, "threadGroupName", "TCP Smoke Test"),
            guiClass: "ThreadGroupGui",
            "ThreadGroup.num_threads": numberInput(input, "threads", 5),
            "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", 5)),
            "LoopController.loops": numberInput(input, "loops", 1)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "TCPSampler",
          fields: {
            name: "TCP Smokes",
            guiClass: "TCPSamplerGui",
            "TCPSampler.server": stringInput(input, "server", "localhost"),
            ...(port !== undefined ? { "TCPSampler.port": port } : {}),
            "TCPSampler.text": stringInput(input, "text", "ping"),
            "TCPSampler.timeout": numberInput(input, "timeout", 5000)
          }
        },
        {
          op: "addNode",
          parentNodeId: threadGroupId,
          nodeType: "ResultCollector",
          fields: { name: "Summary Report", guiClass: "SummaryReport" }
        }
      ]
    };
  }
};
