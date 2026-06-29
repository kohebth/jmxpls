import { createInterface } from "node:readline";

import { createJmxplsServer } from "../server.js";
import { JmxplsRuntime } from "../runtime/execution-runtime.js";

export type StdioRequest = {
  id?: string | number;
  method: "server/info" | "tools/list" | "tools/call" | "resources/read";
  params?: Record<string, unknown>;
};

export function runStdioServer(): void {
  const server = createJmxplsServer();
  const runtime = new JmxplsRuntime();
  const lines = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  process.stdout.write(`${JSON.stringify({ ready: true, resources: server.resources.length, tools: server.tools.length, prompts: server.prompts.length })}\n`);

  lines.on("line", (line) => {
    void handleLine(line, server, runtime);
  });
}

async function handleLine(line: string, server: ReturnType<typeof createJmxplsServer>, runtime: JmxplsRuntime): Promise<void> {
  try {
    const request = JSON.parse(line) as StdioRequest;
    let result: unknown;

    switch (request.method) {
      case "server/info":
        result = server;
        break;
      case "tools/list":
        result = server.tools;
        break;
      case "tools/call":
        result = await runtime.callTool(String(request.params?.name), asObject(request.params?.arguments));
        break;
      case "resources/read":
        result = runtime.readResource(String(request.params?.uri));
        break;
    }

    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown stdio error" })}\n`);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
