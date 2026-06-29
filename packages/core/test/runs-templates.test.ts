import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { atomicWriteFile, backupFile, buildJMeterCliCommand, computeJtlMetrics, createBuiltInTemplateRegistry, parseJtlCsv, renderMetricsReport } from "../src/index.js";

describe("runs, IO, and templates", () => {
  it("builds allowlisted JMeter commands", () => {
    expect(buildJMeterCliCommand("plan.jmx", "out.jtl").args).toEqual(["-n", "-t", "plan.jmx", "-l", "out.jtl"]);
  });

  it("parses JTL and computes metrics", () => {
    const samples = parseJtlCsv("elapsed,label,responseCode,success\n100,GET /,200,true\n300,POST /,500,false\n");
    const metrics = computeJtlMetrics(samples);

    expect(metrics.samples).toBe(2);
    expect(metrics.errors).toBe(1);
    expect(renderMetricsReport(metrics)).toContain("samples=2");
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
    expect(createBuiltInTemplateRegistry().get("http_api_baseline")?.instantiate().operations).toEqual([]);
  });
});
