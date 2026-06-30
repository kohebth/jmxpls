import { createInterface } from "node:readline";

import { createJmxplsServer } from "../server.js";
import { JmxplsRuntime } from "../runtime/execution-runtime.js";

export type StdioRequest = {
  id?: string | number;
  method: "server/info" | "tools/list" | "tools/call" | "resources/read" | "prompts/list" | "prompts/get";
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

export function resolvePromptTemplate(template: string, args: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (typeof key !== "string") {
      return match;
    }
    const value = args[key];
    return value === undefined ? match : asString(value);
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
      case "prompts/list":
        result = server.prompts;
        break;
      case "tools/call":
        result = await runtime.callTool(asString(request.params?.name), asObject(request.params?.arguments));
        break;
      case "resources/read":
        result = runtime.readResource(asString(request.params?.uri));
        break;
      case "prompts/get": {
        const name = asString(request.params?.name);
        const prompt = server.prompts.find((item) => item.name === name);
        if (!prompt) {
          result = { error: `Unknown prompt: ${name}` };
          break;
        }
        const args = asObject(request.params?.arguments);
        result = {
          name: prompt.name,
          description: prompt.description,
          messages: [{ role: "user", content: resolvePromptTemplate(prompt.content, args) }]
        };
        break;
      }
    }

    process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: error instanceof Error ? error.message : "Unknown stdio error" })}\n`);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}
