import { jmeterArtifact } from "./download-jmeter.js";

export type CompatibilityResult = {
  version: string;
  status: "configured" | "pending";
};

export function compatibilityMatrix(versions: string[]): CompatibilityResult[] {
  return versions.map((version) => ({ version: jmeterArtifact(version).version, status: "pending" }));
}
