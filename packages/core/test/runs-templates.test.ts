import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { atomicWriteFile, backupFile, buildJMeterCliCommand, checkSla, compareJtlMetrics, computeJtlMetrics, createBuiltInTemplateRegistry, parseJtlCsv, renderMetricsReport } from "../src/index.js";

describe("runs, IO, and templates", () => {
  it("builds allowlisted JMeter commands", () => {
    expect(buildJMeterCliCommand("plan.jmx", "out.jtl").args).toEqual(["-n", "-t", "plan.jmx", "-l", "out.jtl"]);
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

    expect(patch?.operations).toHaveLength(4);
    expect(patch?.operations[0]).toMatchObject({ op: "addNode", nodeType: "ThreadGroup" });
    expect(patch?.operations[2]).toMatchObject({ op: "addNode", parentNodeId: "template-http-api-thread-group", nodeType: "HTTPSamplerProxy" });
    expect(bearerPatch?.operations).toHaveLength(6);
    expect(bearerPatch?.operations[2]).toMatchObject({ op: "addNode", nodeId: "template-login-bearer-request", nodeType: "HTTPSamplerProxy" });
    expect(bearerPatch?.operations[3]).toMatchObject({ op: "addNode", parentNodeId: "template-login-bearer-request", nodeType: "JSONPostProcessor" });
  });
});
