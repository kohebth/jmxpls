import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { atomicWriteFile, backupFile, buildJMeterCliCommand, checkSla, compareJtlMetrics, computeJtlMetrics, createBuiltInTemplateRegistry, isAllowedJMeterExecutable, parseJtlCsv, renderMetricsReport } from "../src/index.js";

const loadProfileTimers = {
  constant_load_profile: "ConstantTimer",
  ramp_load_profile: "PreciseThroughputTimer",
  spike_load_profile: "SyncTimer",
  stress_load_profile: "ConstantThroughputTimer",
  soak_load_profile: "ConstantThroughputTimer"
};

describe("runs, IO, and templates", () => {
  it("builds allowlisted JMeter commands", () => {
    expect(buildJMeterCliCommand("plan.jmx", "out.jtl").args).toEqual(["-n", "-t", "plan.jmx", "-l", "out.jtl"]);
    expect(isAllowedJMeterExecutable("/opt/jmeter/bin/jmeter")).toBe(true);
    expect(isAllowedJMeterExecutable("/bin/sh")).toBe(false);
  });

  it("parses JTL and computes metrics", () => {
    const samples = parseJtlCsv("timeStamp,elapsed,label,responseCode,success,bytes,sentBytes\n1000,100,GET /,200,true,10,1\n2000,300,POST /,500,false,20,2\n");
    const metrics = computeJtlMetrics(samples);

    expect(metrics.samples).toBe(2);
    expect(metrics.errors).toBe(1);
    expect(metrics.responseCodes["500"]).toBe(1);
    expect(metrics.labels["POST /"]?.p95).toBe(300);
    expect(renderMetricsReport(metrics)).toContain("p95=290");
  });

  it("handles quoted JTL labels, comparisons, and SLA checks", () => {
    const baseline = parseJtlCsv("elapsed,label,responseCode,success\n100,\"GET, quoted\",200,true\n");
    const candidate = parseJtlCsv("elapsed,label,responseCode,success\n200,\"GET, quoted\",200,true\n400,POST /,500,false\n");
    const comparison = compareJtlMetrics(baseline, candidate);
    const sla = checkSla(candidate, { maxErrorRate: 0.4, maxP95Ms: 300 });

    expect(baseline[0]?.label).toBe("GET, quoted");
    expect(comparison.delta.samples).toBe(1);
    expect(sla.passed).toBe(false);
    expect(sla.failures.some((failure) => failure.includes("errorRate"))).toBe(true);
  });

  it("writes atomically and backs up files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "jmxpls-io-"));
    const path = join(dir, "file.txt");
    await atomicWriteFile(path, "one");
    writeFileSync(path, "two");
    const backup = await backupFile(path);

    expect(backup).toContain(".bak");
  });

  it("registers built-in templates", () => {
    const registry = createBuiltInTemplateRegistry();
    const patch = registry.get("http_api_baseline")?.instantiate();
    const bearerPatch = registry.get("http_api_login_bearer_token")?.instantiate();
    const csvPatch = registry.get("csv_driven_login_flow")?.instantiate();
    const blankPatch = registry.get("blank_test_plan")?.instantiate();
    const crudPatch = registry.get("crud_api_flow")?.instantiate();
    const influxPatch = registry.get("backend_listener_influxdb_profile")?.instantiate();
    const jdbcPatch = registry.get("jdbc_query_test")?.instantiate();
    const jmsPatch = registry.get("jms_point_to_point_test")?.instantiate();
    const tcpPatch = registry.get("tcp_smoke_test")?.instantiate();
    const ciPatch = registry.get("jmeter_ci_artifact_profile")?.instantiate();

    expect(patch?.operations).toHaveLength(4);
    expect(patch?.operations[0]).toMatchObject({ op: "addNode", nodeType: "ThreadGroup" });
    expect(patch?.operations[2]).toMatchObject({ op: "addNode", parentNodeId: "template-http-api-thread-group", nodeType: "HTTPSamplerProxy" });
    expect(registry.get("http_api_baseline")?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "domain", type: "string", defaultValue: "example.com" }),
      expect.objectContaining({ name: "threads", type: "number", defaultValue: 10 })
    ]));
    expect(registry.get("http_api_baseline")?.instantiate({ idPrefix: "custom-api", domain: "api.internal", protocol: "http", port: 8080, path: "/ready", method: "HEAD", threads: 3, rampSec: 5, loops: 2 }).operations).toEqual([
      expect.objectContaining({ op: "addNode", nodeId: "custom-api-thread-group", fields: expect.objectContaining({ "ThreadGroup.num_threads": 3, "ThreadGroup.ramp_time": 5, "LoopController.loops": 2 }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-api-thread-group", fields: expect.objectContaining({ "HTTPSampler.protocol": "http", "HTTPSampler.domain": "api.internal", "HTTPSampler.port": 8080 }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-api-thread-group", fields: expect.objectContaining({ name: "HEAD /ready", "HTTPSampler.method": "HEAD", "HTTPSampler.path": "/ready" }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-api-thread-group", nodeType: "ResultCollector" })
    ]);
    expect(bearerPatch?.operations).toHaveLength(6);
    expect(bearerPatch?.operations[2]).toMatchObject({ op: "addNode", nodeId: "template-login-bearer-request", nodeType: "HTTPSamplerProxy" });
    expect(bearerPatch?.operations[3]).toMatchObject({ op: "addNode", parentNodeId: "template-login-bearer-request", nodeType: "JSONPostProcessor" });
    expect(registry.get("http_api_login_bearer_token")?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "tokenVariable", type: "string", defaultValue: "authToken" }),
      expect.objectContaining({ name: "authenticatedPath", type: "string", defaultValue: "/profile" })
    ]));
    expect(registry.get("http_api_login_bearer_token")?.instantiate({ idPrefix: "custom-bearer", domain: "secure.example", loginPath: "/auth/login", authenticatedPath: "/v1/me", tokenVariable: "jwt", tokenJsonPath: "$.access_token", authHeaderPrefix: "Token" }).operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: "addNode", nodeId: "custom-bearer-thread-group" }),
      expect.objectContaining({ op: "addNode", nodeId: "custom-bearer-request", fields: expect.objectContaining({ "HTTPSampler.path": "/auth/login" }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-bearer-request", fields: expect.objectContaining({ "JSONPostProcessor.referenceNames": "jwt", "JSONPostProcessor.jsonPathExprs": "$.access_token" }) }),
      expect.objectContaining({ op: "addNode", fields: expect.objectContaining({ "HeaderManager.headers": "{\"Authorization\":\"Token ${jwt}\"}" }) }),
      expect.objectContaining({ op: "addNode", fields: expect.objectContaining({ "HTTPSampler.path": "/v1/me" }) })
    ]));
    expect(csvPatch?.operations).toHaveLength(5);
    expect(csvPatch?.operations[1]).toMatchObject({ op: "addNode", parentNodeId: "template-csv-login-thread-group", nodeType: "CSVDataSet" });
    expect(csvPatch?.operations[4]).toMatchObject({ op: "addNode", parentNodeId: "template-csv-login-request", nodeType: "ResponseAssertion" });
    expect(registry.get("csv_driven_login_flow")?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "csvFilename", type: "string", defaultValue: "users.csv" }),
      expect.objectContaining({ name: "expectedStatus", type: "string", defaultValue: "200" })
    ]));
    expect(registry.get("csv_driven_login_flow")?.instantiate({ idPrefix: "custom-csv", csvFilename: "accounts.csv", usernameVariable: "email", passwordVariable: "secret", domain: "login.example", expectedStatus: "204" }).operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: "addNode", nodeId: "custom-csv-thread-group" }),
      expect.objectContaining({ op: "addNode", fields: expect.objectContaining({ filename: "accounts.csv", variableNames: "email,secret" }) }),
      expect.objectContaining({ op: "addNode", nodeId: "custom-csv-request", fields: expect.objectContaining({ "HTTPSampler.postBodyRaw": "{\"username\":\"${email}\",\"password\":\"${secret}\"}" }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-csv-request", fields: expect.objectContaining({ "Assertion.test_strings": "[\"204\"]" }) })
    ]));
    expect(blankPatch?.operations).toHaveLength(3);
    expect(blankPatch?.operations[0]).toMatchObject({ op: "addNode", nodeType: "ThreadGroup" });
    expect(blankPatch?.operations[1]).toMatchObject({ op: "addNode", parentNodeId: "template-blank-thread-group", nodeType: "ConfigTestElement" });
    expect(blankPatch?.operations[2]).toMatchObject({ op: "addNode", parentNodeId: "template-blank-thread-group", nodeType: "ResultCollector" });
    expect(crudPatch?.operations).toHaveLength(7);
    expect(crudPatch?.operations[0]).toMatchObject({ op: "addNode", nodeType: "ThreadGroup" });
    expect(crudPatch?.operations[2]).toMatchObject({ op: "addNode", nodeType: "HTTPSamplerProxy", nodeId: "template-crud-api-request-create" });
    expect(influxPatch?.operations).toHaveLength(3);
    expect(influxPatch?.operations[1]).toMatchObject({ op: "addNode", nodeType: "BackendListener" });
    expect(ciPatch?.operations).toHaveLength(4);
    expect(ciPatch?.operations[2]).toMatchObject({ op: "addNode", nodeType: "BackendListener" });
    expect(jdbcPatch?.operations).toHaveLength(5);
    expect(jdbcPatch?.operations[1]).toMatchObject({ op: "addNode", nodeType: "JDBCDataSource" });
    expect(jdbcPatch?.operations[2]).toMatchObject({ op: "addNode", nodeType: "JDBCSampler" });
    expect(jmsPatch?.operations).toHaveLength(3);
    expect(jmsPatch?.operations[1]).toMatchObject({ op: "addNode", nodeType: "JMSSampler" });
    expect(tcpPatch?.operations).toHaveLength(3);
    expect(tcpPatch?.operations[1]).toMatchObject({ op: "addNode", nodeType: "TCPSampler" });
    expect(registry.get("backend_listener_influxdb_profile")?.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "influxdbUrl", type: "string" }),
      expect.objectContaining({ name: "influxdbName", type: "string" })
    ]));
    for (const [name, timerType] of Object.entries(loadProfileTimers)) {
      const operations = registry.get(name)?.instantiate().operations;
      expect(operations).toHaveLength(5);
      expect(operations?.[0]).toMatchObject({ op: "addNode", parentNodeId: "root", nodeType: "ThreadGroup" });
      expect(operations?.[2]).toMatchObject({ op: "addNode", nodeType: "HTTPSamplerProxy" });
      expect(operations?.[3]).toMatchObject({ op: "addNode", nodeType: timerType });
      expect(registry.get(name)?.parameters).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "durationSec", type: "number" }),
        expect.objectContaining({ name: "targetThroughput", type: "number" })
      ]));
    }
    expect(registry.get("ramp_load_profile")?.instantiate({ idPrefix: "custom-ramp", domain: "load.example", path: "/v2/ping", threads: 75, rampSec: 600, durationSec: 1200, targetThroughput: 450, throughputPeriod: 30 }).operations).toEqual([
      expect.objectContaining({ op: "addNode", nodeId: "custom-ramp-thread-group", fields: expect.objectContaining({ "ThreadGroup.num_threads": 75, "ThreadGroup.ramp_time": 600, "ThreadGroup.duration": 1200 }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-ramp-thread-group", fields: expect.objectContaining({ "HTTPSampler.domain": "load.example" }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-ramp-thread-group", fields: expect.objectContaining({ "HTTPSampler.path": "/v2/ping" }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-ramp-thread-group", nodeType: "PreciseThroughputTimer", fields: expect.objectContaining({ throughput: 450, throughputPeriod: 30, duration: 1200 }) }),
      expect.objectContaining({ op: "addNode", parentNodeId: "custom-ramp-thread-group", nodeType: "ResultCollector" })
    ]);
  });
});
