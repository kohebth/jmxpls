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
const SERVER_SHUTTING_DOWN = -32000;
const SERVER_NOT_INITIALIZED = -32002;
const LIST_PAGE_SIZE = 50;

type JsonRpcId = string | number;
type JsonRpcResponseId = JsonRpcId | null;
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcResponseId;
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
type SessionState = "new" | "initializing" | "ready" | "shutdown";

export function runStdioServer(): void {
  const server = createJmxplsServer();
  const runtime = new JmxplsRuntime();
  const session = new JsonRpcMcpSession(server, runtime);
  const lines = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  let chain = Promise.resolve();

  lines.on("line", (line) => {
    chain = chain.then(async () => {
      await handleLine(line, session, (response) => {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      });
      if (session.shouldClose) {
        lines.close();
        process.stdin.pause();
      }
    });
  });
}

export async function handleJsonRpcMessage(line: string, server: ServerLike = createJmxplsServer(), runtime: RuntimeLike = new JmxplsRuntime()): Promise<JsonRpcMessageResponse | undefined> {
  return handleJsonRpcMessageWithState(line, server, runtime);
}

export class JsonRpcMcpSession {
  private state: SessionState;
  shouldClose = false;

  constructor(private readonly server: ServerLike = createJmxplsServer(), private readonly runtime: RuntimeLike = new JmxplsRuntime(), initialState: SessionState = "new") {
    this.state = initialState;
  }

  async handleMessage(line: string): Promise<JsonRpcMessageResponse | undefined> {
    return handleJsonRpcMessageWithState(line, this.server, this.runtime, this);
  }

  lifecycleError(request: JsonRpcRequest): { code: number; message: string } | undefined {
    if (request.method === "ping") {
      return undefined;
    }
    if (request.method === "initialize") {
      return this.state === "new" ? undefined : { code: INVALID_REQUEST, message: "Server is already initialized" };
    }
    if (this.state === "shutdown") {
      return { code: SERVER_SHUTTING_DOWN, message: "Server is shutting down" };
    }
    if (this.state !== "ready") {
      return { code: SERVER_NOT_INITIALIZED, message: "Server is not initialized" };
    }
    if (request.method === "shutdown") {
      return undefined;
    }
    return undefined;
  }

  markRequestHandled(request: JsonRpcRequest): void {
    if (request.method === "initialize") {
      this.state = "initializing";
    } else if (request.method === "shutdown") {
      this.state = "shutdown";
    }
  }

  handleNotification(request: JsonRpcRequest): void {
    if (request.method === "notifications/initialized" && this.state === "initializing") {
      this.state = "ready";
    }
    if (request.method === "exit") {
      this.shouldClose = true;
    }
  }
}

async function handleJsonRpcMessageWithState(line: string, server: ServerLike, runtime: RuntimeLike, session?: JsonRpcMcpSession): Promise<JsonRpcMessageResponse | undefined> {
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
    const responses: JsonRpcResponse[] = [];
    for (const item of parsed) {
      const response = await handleJsonRpcValue(item, server, runtime, session);
      if (response) responses.push(response);
    }
    return responses.length > 0 ? responses : undefined;
  }

  return handleJsonRpcValue(parsed, server, runtime, session);
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

async function handleJsonRpcValue(parsed: unknown, server: ServerLike, runtime: RuntimeLike, session?: JsonRpcMcpSession): Promise<JsonRpcResponse | undefined> {
  if (isJsonRpcResponse(parsed)) {
    return undefined;
  }

  const requestError = validateRequest(parsed);
  if (requestError) {
    return errorResponse(requestId(parsed), requestError.code, requestError.message);
  }

  const request = parsed as JsonRpcRequest;
  if (request.id === undefined) {
    session?.handleNotification(request);
    handleNotification(request);
    return undefined;
  }

  const lifecycleError = session?.lifecycleError(request);
  if (lifecycleError) {
    return errorResponse(request.id, lifecycleError.code, lifecycleError.message);
  }

  try {
    const response = successResponse(request.id, await dispatchRequest(request, server, runtime));
    session?.markRequestHandled(request);
    return response;
  } catch (error) {
    if (error instanceof RpcError) {
      return errorResponse(request.id, error.code, error.message, error.data);
    }
    return errorResponse(request.id, INTERNAL_ERROR, "Internal error", errorMessage(error));
  }
}

async function handleLine(line: string, session: JsonRpcMcpSession, write: (response: JsonRpcMessageResponse) => void): Promise<void> {
  const response = await session.handleMessage(line);
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
      return listResult("tools", server.tools, request.params);
    case "resources/list":
      return listResult("resources", concreteResources(server.resources), request.params);
    case "resources/templates/list":
      return listResult("resourceTemplates", resourceTemplates(server.resources), request.params);
    case "prompts/list":
      return listResult("prompts", server.prompts.map((prompt) => ({ name: prompt.name, description: prompt.description, arguments: prompt.arguments ?? [] })), request.params);
    case "tools/call":
      return toolCallResult(await callTool(server, runtime, request.params));
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
  validateInitializeParams(params);
  return {
    protocolVersion: params?.protocolVersion === MCP_PROTOCOL_VERSION ? params.protocolVersion : MCP_PROTOCOL_VERSION,
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

function validateInitializeParams(params: Record<string, unknown> | undefined): void {
  if (!params || typeof params.protocolVersion !== "string" || !isObject(params.capabilities) || !isObject(params.clientInfo)) {
    throw new RpcError(INVALID_PARAMS, "initialize params must include protocolVersion, capabilities, and clientInfo");
  }
  if (typeof params.clientInfo.name !== "string" || typeof params.clientInfo.version !== "string") {
    throw new RpcError(INVALID_PARAMS, "clientInfo must include name and version");
  }
}

function concreteResources(resources: ServerLike["resources"]): Array<{ uri: string; name: string; description: string }> {
  return resources.filter((resource) => !isTemplatedUri(resource.uriTemplate)).map(({ uriTemplate, ...resource }) => ({ uri: uriTemplate, ...resource }));
}

function resourceTemplates(resources: ServerLike["resources"]): ServerLike["resources"] {
  return resources.filter((resource) => isTemplatedUri(resource.uriTemplate));
}

function isTemplatedUri(uri: string): boolean {
  return uri.includes("{");
}

function listResult<T>(key: string, items: T[], params: Record<string, unknown> | undefined): Record<string, unknown> {
  const start = cursorStart(params);
  const next = start + LIST_PAGE_SIZE;
  return {
    [key]: items.slice(start, next),
    ...(next < items.length ? { nextCursor: String(next) } : {})
  };
}

function cursorStart(params: Record<string, unknown> | undefined): number {
  const cursor = params?.cursor;
  if (cursor === undefined) {
    return 0;
  }
  if (typeof cursor !== "string" || !/^(0|[1-9]\d*)$/.test(cursor)) {
    throw new RpcError(INVALID_PARAMS, "cursor must be a non-negative integer");
  }
  return Number(cursor);
}

function toolCallResult(result: { success: boolean; data?: unknown; error?: string }): Record<string, unknown> {
  return {
    content: [{ type: "text", text: stringify(result.success ? result.data ?? {} : { error: result.error ?? "Tool call failed" }) }],
    structuredContent: result,
    isError: !result.success
  };
}

async function callTool(server: ServerLike, runtime: RuntimeLike, params: Record<string, unknown> | undefined): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const name = requiredString(params, "name");
  if (!server.tools.some((tool) => tool.name === name)) {
    throw new RpcError(INVALID_PARAMS, `Unknown tool: ${name}`);
  }
  return runtime.callTool(name, toolArguments(params?.arguments));
}

function toolArguments(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (!isObject(value)) {
    throw new RpcError(INVALID_PARAMS, "arguments must be an object when present");
  }
  return value;
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
  const args = promptArguments(params?.arguments);
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

function promptArguments(value: unknown): Record<string, string> {
  if (value === undefined) {
    return {};
  }
  if (!isObject(value)) {
    throw new RpcError(INVALID_PARAMS, "prompt arguments must be an object when present");
  }
  const args = value;
  if (Object.values(args).some((item) => typeof item !== "string")) {
    throw new RpcError(INVALID_PARAMS, "prompt arguments must be string values");
  }
  return args as Record<string, string>;
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
  if ("id" in value && typeof value.id !== "string" && typeof value.id !== "number") {
    return { code: INVALID_REQUEST, message: "id must be a string or number when present" };
  }
  if (value.params !== undefined && !isObject(value.params)) {
    return { code: INVALID_PARAMS, message: "params must be an object when present" };
  }
  return undefined;
}

function isJsonRpcResponse(value: unknown): boolean {
  if (!isObject(value) || value.jsonrpc !== JSONRPC_VERSION || !("id" in value) || "method" in value) {
    return false;
  }
  const hasValidId = value.id === null || typeof value.id === "string" || typeof value.id === "number";
  if (!hasValidId) {
    return false;
  }
  if ("result" in value) {
    return !("error" in value);
  }
  return isObject(value.error) && typeof value.error.code === "number" && typeof value.error.message === "string";
}

function successResponse(id: JsonRpcId, result: Record<string, unknown>): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

function errorResponse(id: JsonRpcResponseId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, error: data === undefined ? { code, message } : { code, message, data } };
}

function requestId(value: unknown): JsonRpcResponseId {
  if (isObject(value) && (typeof value.id === "string" || typeof value.id === "number")) {
    return value.id;
  }
  return null;
}

function requiredString(params: Record<string, unknown> | undefined, key: string): string {
  const value = params?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new RpcError(INVALID_PARAMS, `${key} is required`);
  }
  return value;
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
