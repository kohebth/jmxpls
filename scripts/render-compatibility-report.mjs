import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = process.argv[2] ?? "5.6.3";
const outputDir = process.argv[3] ?? "compatibility";
const checks = [
  { name: "bridge-validation", command: "corepack pnpm bridge:build", required: true },
  { name: "serializer-roundtrip", command: "corepack pnpm --filter @jmxpls/core build", required: true },
  { name: "mcp-runtime-smoke", command: "corepack pnpm --filter @jmxpls/mcp-server build", required: true }
];

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, `jmeter-${version}.json`), `${JSON.stringify({
  generatedAt: new Date(0).toISOString(),
  matrix: [{
    version,
    artifact: {
      version,
      archiveName: `apache-jmeter-${version}.tgz`,
      url: `https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${version}.tgz`,
      checksumUrl: `https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${version}.tgz.sha512`
    },
    status: "configured",
    checks,
    reportPath: `compatibility/jmeter-${version}.json`
  }]
}, null, 2)}\n`);
