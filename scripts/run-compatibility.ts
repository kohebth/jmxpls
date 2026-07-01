import { JMETER_COMPATIBILITY_VERSIONS, jmeterArtifact, type JMeterArtifact } from "./download-jmeter.js";

export type CompatibilityResult = {
  version: string;
  artifact: JMeterArtifact;
  status: "configured" | "pending";
  checks: string[];
  reportPath: string;
};

const COMPATIBILITY_CHECKS = [
  "bridge-validation",
  "serializer-roundtrip",
  "mcp-runtime-smoke"
] as const;

export function compatibilityMatrix(versions: readonly string[] = JMETER_COMPATIBILITY_VERSIONS): CompatibilityResult[] {
  return versions.map((version) => {
    const artifact = jmeterArtifact(version);
    return {
      version: artifact.version,
      artifact,
      status: "pending",
      checks: [...COMPATIBILITY_CHECKS],
      reportPath: `compatibility/jmeter-${artifact.version}.json`
    };
  });
}

export function renderCompatibilityReport(results: CompatibilityResult[]): string {
  return JSON.stringify({
    generatedAt: new Date(0).toISOString(),
    matrix: results
  }, null, 2);
}
