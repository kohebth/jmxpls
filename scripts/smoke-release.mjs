import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const node = process.execPath;
const corepack = process.env.COREPACK_BIN ?? "corepack";
const npm = process.env.NPM_BIN ?? "npm";
const gradle = process.env.GRADLE_BIN ?? "/opt/gradle/bin/gradle";
const bridgeJar = process.env.JMXPLS_JAVA_BRIDGE_JAR ?? join(root, "packages/java-bridge/build/libs/jmxpls-java-bridge-0.0.0.jar");
const jmeterHome = process.env.JMETER_HOME ?? "/home/duync/Applications/apache-jmeter-5.6.3";
const javaHome = process.env.JAVA_HOME ?? "/home/duync/toolchains/jdk-17.0.4.1";
const corepackHome = process.env.COREPACK_HOME ?? mkdtempSync(join(tmpdir(), "jmxpls-corepack-"));
const gradleUserHome = process.env.GRADLE_USER_HOME ?? mkdtempSync(join(tmpdir(), "jmxpls-gradle-"));

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  JMETER_HOME: jmeterHome,
  JMXPLS_JAVA_BRIDGE_JAR: bridgeJar,
  COREPACK_HOME: corepackHome,
  GRADLE_USER_HOME: gradleUserHome,
  PATH: `${join(jmeterHome, "bin")}:${join(javaHome, "bin")}:/opt/gradle/bin:/home/duync/.nvm/versions/node/v22.14.0/bin:${process.env.PATH ?? ""}`
};

try {
  run(corepack, ["pnpm", "-r", "build"], { env });
  run(gradle, ["-p", "packages/java-bridge", "jar"], { env });

  const environment = rpc("get_jmeter_environment", {});
  assert(environment.bridgeConfigured === true, "bridge is configured");
  assert(environment.environment?.status === "jmeter-configured", "JMeter environment is configured");

  const minimal = rpc("validate_with_jmeter", { path: join(root, "fixtures/jmx/minimal.jmx"), mode: "loadSaveReload", strict: true });
  assert(minimal.jmeterBacked === true && minimal.valid === true, "minimal fixture validates with JMeter bridge");

  const roundtrip = rpc("roundtrip_validate", { path: join(root, "fixtures/jmx/minimal.jmx"), strict: true });
  assert(roundtrip.jmeterBacked === true && roundtrip.valid === true && roundtrip.bridge?.roundTripValid === true, "minimal fixture round-trips");

  const plugin = rpc("validate_with_jmeter", { path: join(root, "fixtures/plugins/unknown-plugin.jmx"), mode: "loadSaveReload", strict: true });
  assert(plugin.jmeterBacked === true && plugin.valid === false, "unknown plugin fixture fails bridge validation");
  assert((plugin.diagnostics ?? []).some((diagnostic) => diagnostic.code === "JMX_JMETER_PLUGIN_CLASS_MISSING"), "unknown plugin diagnostic is actionable");

  packAndSmoke();

  if (process.argv.includes("--docker")) {
    run("docker", ["build", "-t", "jmxpls:local", "."], { stdio: "inherit" });
    const output = run("docker", ["run", "--rm", "-i", "-v", `${join(root, "fixtures")}:/workspace/fixtures:ro`, "jmxpls:local"], {
      input: `${initializeLines()}{"jsonrpc":"2.0","id":"resources","method":"resources/list"}\n`
    });
    assert(output.includes("\"resources\""), "Docker image responds to MCP resources/list");
  }

  console.log("release smoke passed");
} finally {
  if (process.env.COREPACK_HOME === undefined) {
    rmSync(corepackHome, { recursive: true, force: true });
  }
  if (process.env.GRADLE_USER_HOME === undefined) {
    rmSync(gradleUserHome, { recursive: true, force: true });
  }
}

function rpc(name, args) {
  const output = run(node, [join(root, "packages/mcp-server/dist/index.js")], {
    env,
    input: `${initializeLines()}{"jsonrpc":"2.0","id":"call","method":"tools/call","params":{"name":${JSON.stringify(name)},"arguments":${JSON.stringify(args)}}}\n`
  });
  const response = output.trim().split("\n").map((line) => JSON.parse(line)).find((message) => message.id === "call");
  if (!response?.result?.structuredContent?.success) {
    throw new Error(`RPC ${name} failed: ${output}`);
  }
  return response.result.structuredContent.data;
}

function packAndSmoke() {
  const packDir = mkdtempSync(join(tmpdir(), "jmxpls-pack-"));
  const installDir = mkdtempSync(join(tmpdir(), "jmxpls-install-"));
  const npmCache = mkdtempSync(join(tmpdir(), "jmxpls-npm-cache-"));
  try {
    run(corepack, ["pnpm", "--dir", "packages/core", "pack", "--pack-destination", packDir], { env });
    run(corepack, ["pnpm", "--dir", "packages/mcp-server", "pack", "--pack-destination", packDir], { env });
    run(npm, ["init", "-y"], { cwd: installDir, env });
    run(npm, ["--cache", npmCache, "install", join(packDir, "jmxpls-core-0.0.0.tgz"), join(packDir, "jmxpls-mcp-server-0.0.0.tgz")], { cwd: installDir, env });
    const output = run(join(installDir, "node_modules/.bin/jmxpls"), [], {
      cwd: installDir,
      env,
      input: `${initializeLines()}{"jsonrpc":"2.0","id":"tools","method":"tools/list"}\n`
    });
    assert(output.includes("\"tools\""), "packed binary responds to tools/list");
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(installDir, { recursive: true, force: true });
    rmSync(npmCache, { recursive: true, force: true });
  }
}

function initializeLines() {
  return [
    "{\"jsonrpc\":\"2.0\",\"id\":\"init\",\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},\"clientInfo\":{\"name\":\"release-smoke\",\"version\":\"1.0.0\"}}}",
    "{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}"
  ].join("\n") + "\n";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    input: options.input,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Smoke assertion failed: ${message}`);
  }
}
