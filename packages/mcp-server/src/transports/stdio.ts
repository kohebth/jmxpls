import { createInterface } from "node:readline";

import { createJmxplsServer } from "../server.js";
import { JmxplsRuntime } from "../runtime/execution-runtime.js";

const JSONRPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2025-06-18";

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};
export type JsonRpcMessageResponse = JsonRpcResponse | JsonRpcResponse[];

type RuntimeLike = Pick<JmxplsRuntime, "callTool" | "readResource">;
type ServerLike = ReturnType<typeof createJmxplsServer>;

export function runStdioServer(): void {
  const server = createJmxplsServer();
  const runtime = new JmxplsRuntime();
  const lines = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

  lines.on("line", (line) => {
    void (async () => {
      await handleLine(line, server, runtime, (response) => {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      });
      if (isShutdownMessage(line)) {
        lines.close();
        process.stdin.pause();
      }
    })();
  });
}

export async function handleJsonRpcMessage(line: string, server: ServerLike = createJmxplsServer(), runtime: RuntimeLike = new JmxplsRuntime()): Promise<JsonRpcMessageResponse | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    return errorResponse(null, PARSE_ERROR, "Parse error", errorMessage(error));
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return errorResponse(null, INVALID_REQUEST, "Invalid Request");
    }
    const responses = (await Promise.all(parsed.map((item) => handleJsonRpcValue(item, server, runtime)))).filter((response): response is JsonRpcResponse => response !== undefined);
    return responses.length > 0 ? responses : undefined;
  }

  return handleJsonRpcValue(parsed, server, runtime);
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

async function handleJsonRpcValue(parsed: unknown, server: ServerLike, runtime: RuntimeLike): Promise<JsonRpcResponse | undefined> {
  const requestError = validateRequest(parsed);
  if (requestError) {
    return errorResponse(requestId(parsed), requestError.code, requestError.message);
  }

  const request = parsed as JsonRpcRequest;
  if (request.id === undefined) {
    handleNotification(request);
    return undefined;
  }

  try {
    return successResponse(request.id, await dispatchRequest(request, server, runtime));
  } catch (error) {
    if (error instanceof RpcError) {
      return errorResponse(request.id, error.code, error.message, error.data);
    }
    return errorResponse(request.id, INTERNAL_ERROR, "Internal error", errorMessage(error));
  }
}

async function handleLine(line: string, server: ServerLike, runtime: RuntimeLike, write: (response: JsonRpcMessageResponse) => void): Promise<void> {
  const response = await handleJsonRpcMessage(line, server, runtime);
  if (response) {
    write(response);
  }
}

async function dispatchRequest(request: JsonRpcRequest, server: ServerLike, runtime: RuntimeLike): Promise<Record<string, unknown>> {
  switch (request.method) {
    case "initialize":
      return initializeResult(request.params);
    case "shutdown":
      return {};
    case "ping":
      return {};
    case "tools/list":
      return { tools: server.tools };
    case "resources/list":
      return { resources: server.resources.map(({ uriTemplate, ...resource }) => ({ uri: uriTemplate, ...resource })) };
    case "resources/templates/list":
      return { resourceTemplates: server.resources };
    case "prompts/list":
      return { prompts: server.prompts.map((prompt) => ({ name: prompt.name, description: prompt.description, arguments: prompt.arguments ?? [] })) };
    case "tools/call":
      return toolCallResult(await runtime.callTool(requiredString(request.params, "name"), asObject(request.params?.arguments)));
    case "resources/read":
      return resourceReadResult(requiredString(request.params, "uri"), runtime.readResource(requiredString(request.params, "uri")));
    case "prompts/get":
      return promptGetResult(server, request.params);
    default:
      throw new RpcError(METHOD_NOT_FOUND, `Method not found: ${request.method}`);
  }
}

function handleNotification(request: JsonRpcRequest): void {
  if (request.method === "exit" || request.method === "notifications/initialized" || request.method.startsWith("notifications/")) {
    return;
  }
}

function initializeResult(params: Record<string, unknown> | undefined): Record<string, unknown> {
  return {
    protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : MCP_PROTOCOL_VERSION,
    capabilities: {
      prompts: {},
      resources: {},
      tools: {}
    },
    serverInfo: {
      name: "jmxpls",
      title: "jmxpls",
      version: "0.0.0"
    },
    instructions: "Use compact Plan Language resources and semantic tools before requesting raw JMX."
  };
}

function toolCallResult(result: { success: boolean; data?: unknown; error?: string }): Record<string, unknown> {
  return {
    content: [{ type: "text", text: stringify(result.success ? result.data ?? {} : { error: result.error ?? "Tool call failed" }) }],
    structuredContent: result,
    isError: !result.success
  };
}

function resourceReadResult(uri: string, result: { success: boolean; data?: unknown; error?: string }): Record<string, unknown> {
  if (!result.success) {
    throw new RpcError(INVALID_PARAMS, result.error ?? `Unable to read resource: ${uri}`);
  }
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: stringify(result.data ?? null)
    }]
  };
}

function promptGetResult(server: ServerLike, params: Record<string, unknown> | undefined): Record<string, unknown> {
  const name = requiredString(params, "name");
  const prompt = server.prompts.find((item) => item.name === name);
  if (!prompt) {
    throw new RpcError(INVALID_PARAMS, `Unknown prompt: ${name}`);
  }
  const args = asObject(params?.arguments);
  return {
    description: prompt.description,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: resolvePromptTemplate(prompt.content, args)
      }
    }]
  };
}

function validateRequest(value: unknown): { code: number; message: string } | undefined {
  if (!isObject(value)) {
    return { code: INVALID_REQUEST, message: "Invalid Request" };
  }
  if (value.jsonrpc !== JSONRPC_VERSION) {
    return { code: INVALID_REQUEST, message: "jsonrpc must be \"2.0\"" };
  }
  if (typeof value.method !== "string" || value.method.length === 0) {
    return { code: INVALID_REQUEST, message: "method must be a non-empty string" };
  }
  if ("id" in value && value.id !== null && typeof value.id !== "string" && typeof value.id !== "number") {
    return { code: INVALID_REQUEST, message: "id must be a string, number, or null when present" };
  }
  if (value.params !== undefined && !isObject(value.params)) {
    return { code: INVALID_PARAMS, message: "params must be an object when present" };
  }
  return undefined;
}

function successResponse(id: JsonRpcId, result: Record<string, unknown>): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, error: data === undefined ? { code, message } : { code, message, data } };
}

function requestId(value: unknown): JsonRpcId {
  if (isObject(value) && (value.id === null || typeof value.id === "string" || typeof value.id === "number")) {
    return value.id;
  }
  return null;
}

function isShutdownMessage(line: string): boolean {
  try {
    const request = JSON.parse(line) as unknown;
    return Array.isArray(request) ? request.some(isShutdownRequest) : isShutdownRequest(request);
  } catch {
    return false;
  }
}

function isShutdownRequest(request: unknown): boolean {
  return isObject(request) && (request.method === "shutdown" || request.method === "exit");
}

function requiredString(params: Record<string, unknown> | undefined, key: string): string {
  const value = params?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new RpcError(INVALID_PARAMS, `${key} is required`);
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringify(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

class RpcError extends Error {
  constructor(readonly code: number, message: string, readonly data?: unknown) {
    super(message);
  }
}
