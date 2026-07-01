import { describe, expect, it } from "vitest";

import { jmeterArtifact, jmeterArtifacts, JMETER_COMPATIBILITY_VERSIONS } from "../../../scripts/download-jmeter.js";
import { compatibilityMatrix, renderCompatibilityReport } from "../../../scripts/run-compatibility.js";

describe("compatibility scripts", () => {
  it("defines archive and checksum URLs for configured JMeter versions", () => {
    const artifacts = jmeterArtifacts();

    expect(JMETER_COMPATIBILITY_VERSIONS).toEqual(["5.4.3", "5.5", "5.6.3"]);
    expect(jmeterArtifact("5.6.3")).toEqual({
      version: "5.6.3",
      archiveName: "apache-jmeter-5.6.3.tgz",
      url: "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.tgz",
      checksumUrl: "https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.tgz.sha512"
    });
    expect(artifacts.map((artifact) => artifact.version)).toEqual(["5.4.3", "5.5", "5.6.3"]);
  });

  it("renders deterministic compatibility report metadata", () => {
    const matrix = compatibilityMatrix(["5.4.3", "5.6.3"]);
    const report = JSON.parse(renderCompatibilityReport(matrix)) as { generatedAt: string; matrix: Array<{ version: string; checks: Array<{ name: string; command: string; required: boolean }>; reportPath: string }> };

    expect(report.generatedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(report.matrix.map((item) => item.version)).toEqual(["5.4.3", "5.6.3"]);
    expect(report.matrix[0]?.checks.map((check) => check.name)).toEqual(["bridge-validation", "serializer-roundtrip", "mcp-runtime-smoke"]);
    expect(report.matrix[0]?.checks.every((check) => check.required && check.command.length > 0)).toBe(true);
    expect(report.matrix[0]?.reportPath).toBe("compatibility/jmeter-5.4.3.json");
  });
});
