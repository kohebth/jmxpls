import { JMETER_COMPATIBILITY_VERSIONS, jmeterArtifact, type JMeterArtifact } from "./download-jmeter.js";

export type CompatibilityResult = {
  version: string;
  artifact: JMeterArtifact;
  status: "configured" | "pending" | "passed" | "failed";
  checks: CompatibilityCheck[];
  reportPath: string;
};

export type CompatibilityCheck = {
  name: "bridge-validation" | "serializer-roundtrip" | "mcp-runtime-smoke";
  command: string;
  required: boolean;
};

const COMPATIBILITY_CHECKS: CompatibilityCheck[] = [
  { name: "bridge-validation", command: "corepack pnpm bridge:build", required: true },
  { name: "serializer-roundtrip", command: "corepack pnpm --filter @jmxpls/core build", required: true },
  { name: "mcp-runtime-smoke", command: "corepack pnpm --filter @jmxpls/mcp-server build", required: true }
];

export function compatibilityMatrix(versions: readonly string[] = JMETER_COMPATIBILITY_VERSIONS): CompatibilityResult[] {
  return versions.map((version) => {
    const artifact = jmeterArtifact(version);
    return {
      version: artifact.version,
      artifact,
      status: "pending",
      checks: COMPATIBILITY_CHECKS.map((check) => ({ ...check })),
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

export function compatibilityResult(version: string, status: CompatibilityResult["status"] = "configured"): CompatibilityResult {
  return { ...compatibilityMatrix([version])[0]!, status };
}
