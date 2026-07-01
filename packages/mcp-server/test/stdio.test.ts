import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../src/server.js";
import { handleJsonRpcMessage, JsonRpcMcpSession, resolvePromptTemplate } from "../src/transports/stdio.js";

const server = createJmxplsServer();
const runtime = {
  callTool: async (name: string, input: Record<string, unknown>) => ({ success: true, data: { name, input } }),
  readResource: (uri: string) => ({ success: true, data: { uri, ok: true } })
};
const initializeParams = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "test-client", version: "1.0.0" }
};

describe("stdio prompt helpers", () => {
  it("renders prompt templates with arguments", () => {
    const rendered = resolvePromptTemplate("Use plan {{planId}} and path {{planPath}}", { planId: "abc", planPath: "/tmp/plan.jmx" });
    expect(rendered).toBe("Use plan abc and path /tmp/plan.jmx");
  });

  it("keeps placeholders when not provided", () => {
    const rendered = resolvePromptTemplate("Template {{missing}} remains", {});
    expect(rendered).toBe("Template {{missing}} remains");
  });
});

describe("stdio JSON-RPC MCP transport", () => {
  it("responds to initialize with MCP capabilities", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" }
      }
    }), server, runtime);

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: expect.objectContaining({
        protocolVersion: "2025-06-18",
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        },
        serverInfo: expect.objectContaining({ name: "jmxpls" })
      })
    });
  });

  it("negotiates unsupported protocol versions to the supported MCP version", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: { ...initializeParams, protocolVersion: "1900-01-01" }
    }), server, runtime);

    expect(response?.result).toEqual(expect.objectContaining({
      protocolVersion: "2025-06-18"
    }));
  });

  it("rejects initialize requests without required MCP negotiation fields", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "missing", method: "initialize" }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "missing",
      error: { code: -32602, message: "initialize params must include protocolVersion, capabilities, and clientInfo" }
    });

    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "bad-client",
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client" } }
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "bad-client",
      error: { code: -32602, message: "clientInfo must include name and version" }
    });
  });

  it("does not respond to initialized notifications", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    }), server, runtime)).resolves.toBeUndefined();
  });

  it("rejects MCP null request ids", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      method: "ping"
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "id must be a string or number when present" }
    });
  });

  it("returns method not found for non-standard shutdown requests", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "shutdown",
      method: "shutdown"
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "shutdown",
      error: { code: -32601, message: "Method not found: shutdown" }
    });
  });

  it("does not implement non-standard shutdown requests", async () => {
    const session = new JsonRpcMcpSession(server, runtime);
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize", params: initializeParams }));
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "shutdown", method: "shutdown" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "shutdown",
      error: { code: -32601, message: "Method not found: shutdown" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "tools",
      result: expect.objectContaining({ tools: expect.any(Array) })
    });
  });

  it("lists tools, resources, resource templates, and prompts in MCP result wrappers", async () => {
    const tools = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }), server, runtime);
    expect((tools?.result as { tools: unknown[] }).tools.length).toBeGreaterThan(0);

    const resources = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "resources", method: "resources/list" }), server, runtime);
    const listedResources = (resources?.result as { resources: Array<{ uri: string; uriTemplate?: string }> }).resources;
    expect(listedResources.some((resource) => resource.uri === "jmxpls://plans")).toBe(true);
    expect(listedResources.every((resource) => !resource.uri.includes("{") && resource.uriTemplate === undefined)).toBe(true);

    const templates = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "templates", method: "resources/templates/list" }), server, runtime);
    const listedTemplates = (templates?.result as { resourceTemplates: Array<{ uriTemplate: string }> }).resourceTemplates;
    expect(listedTemplates.some((resource) => resource.uriTemplate === "jmxpls://plans/{planId}/summary")).toBe(true);
    expect(listedTemplates.every((resource) => resource.uriTemplate.includes("{"))).toBe(true);

    const prompts = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "prompts", method: "prompts/list" }), server, runtime);
    expect((prompts?.result as { prompts: Array<{ name: string; content?: string }> }).prompts.find((prompt) => prompt.name === "jmeter_plan_review")?.content).toBeUndefined();
  });

  it("lists prompt arguments as MCP PromptArgument objects", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "prompts", method: "prompts/list" }), {
      resources: [],
      tools: [],
      prompts: [{
        name: "review_plan",
        description: "Review a plan.",
        content: "Review {{planId}}",
        arguments: ["planId"]
      }]
    }, runtime);

    expect(response?.result).toEqual({
      prompts: [{
        name: "review_plan",
        description: "Review a plan.",
        arguments: [{ name: "planId" }]
      }]
    });
  });

  it("paginates MCP list methods with opaque cursors", async () => {
    const firstTools = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools-1", method: "tools/list" }), server, runtime);
    const firstToolPage = firstTools?.result as { tools: Array<{ name: string }>; nextCursor?: string };
    expect(firstToolPage.tools).toHaveLength(50);
    expect(firstToolPage.nextCursor).toBe("50");

    const secondTools = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools-2", method: "tools/list", params: { cursor: firstToolPage.nextCursor } }), server, runtime);
    const secondToolPage = secondTools?.result as { tools: Array<{ name: string }>; nextCursor?: string };
    expect(secondToolPage.tools[0]?.name).toBe(server.tools[50]?.name);

    const resources = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "resources-page", method: "resources/list", params: { cursor: "1" } }), server, runtime);
    const resourcePage = resources?.result as { resources: Array<{ uri: string }> };
    expect(resourcePage.resources[0]?.uri).toBe("jmxpls://catalog");

    const templates = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "templates-page", method: "resources/templates/list", params: { cursor: "1" } }), server, runtime);
    const templatePage = templates?.result as { resourceTemplates: Array<{ uriTemplate: string }> };
    expect(templatePage.resourceTemplates[0]?.uriTemplate).toBe("jmxpls://plans/{planId}/tree");

    const prompts = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "prompts-page", method: "prompts/list", params: { cursor: "1" } }), server, runtime);
    const promptPage = prompts?.result as { prompts: Array<{ name: string }> };
    expect(promptPage.prompts[0]?.name).toBe(server.prompts[1]?.name);
  });

  it("rejects invalid pagination cursors", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "bad-cursor", method: "tools/list", params: { cursor: "abc" } }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "bad-cursor",
      error: { code: -32602, message: "cursor must be a non-negative integer" }
    });
  });

  it("handles JSON-RPC batch requests and omits notification responses", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify([
      { jsonrpc: "2.0", id: "ping", method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: "tools", method: "tools/list" }
    ]), server, runtime);

    expect(response).toEqual([
      { jsonrpc: "2.0", id: "ping", result: {} },
      { jsonrpc: "2.0", id: "tools", result: expect.objectContaining({ tools: expect.any(Array) }) }
    ]);
  });

  it("returns no batch response when every item is a notification", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify([
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", method: "notifications/progress" }
    ]), server, runtime)).resolves.toBeUndefined();
  });

  it("accepts JSON-RPC response messages without replying", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "server-request",
      result: {}
    }), server, runtime)).resolves.toBeUndefined();

    const response = await handleJsonRpcMessage(JSON.stringify([
      { jsonrpc: "2.0", id: "server-request", result: {} },
      { jsonrpc: "2.0", id: "ping", method: "ping" },
      { jsonrpc: "2.0", id: "server-error", error: { code: -32603, message: "client-side failure" } }
    ]), server, runtime);

    expect(response).toEqual([
      { jsonrpc: "2.0", id: "ping", result: {} }
    ]);
  });

  it("rejects MCP response messages with null ids", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      result: {}
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "id must be a string or number when present" }
    });
  });

  it("returns an invalid request error for empty JSON-RPC batches", async () => {
    await expect(handleJsonRpcMessage("[]", server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" }
    });
  });

  it("calls tools with MCP content and structured content", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "open_plan",
        arguments: { value: 1 }
      }
    }), server, runtime);

    expect(response?.result).toEqual({
      content: [{ type: "text", text: expect.stringContaining("\"name\": \"open_plan\"") }],
      structuredContent: { success: true, data: { name: "open_plan", input: { value: 1 } } },
      isError: false
    });
  });

  it("returns a protocol error for unknown tools", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "unknown-tool",
      method: "tools/call",
      params: {
        name: "not_registered",
        arguments: {}
      }
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "unknown-tool",
      error: { code: -32602, message: "Unknown tool: not_registered" }
    });
  });

  it("rejects non-object tool arguments", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "bad-tool-args",
      method: "tools/call",
      params: {
        name: "open_plan",
        arguments: "not-an-object"
      }
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "bad-tool-args",
      error: { code: -32602, message: "arguments must be an object when present" }
    });
  });

  it("reads resources and gets prompts with MCP content shapes", async () => {
    const resource = await handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "jmxpls://plans" }
    }), server, runtime);
    expect(resource?.result).toEqual({
      contents: [{
        uri: "jmxpls://plans",
        mimeType: "application/json",
        text: expect.stringContaining("jmxpls://plans")
      }]
    });

    const prompt = await handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "prompts/get",
      params: { name: "jmeter_plan_review", arguments: { planId: "p1" } }
    }), server, runtime);
    expect((prompt?.result as { messages: Array<{ content: { type: string; text: string } }> }).messages[0]?.content.type).toBe("text");
  });

  it("rejects non-string prompt arguments", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "prompt-args",
      method: "prompts/get",
      params: { name: "jmeter_plan_review", arguments: { planId: 123 } }
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "prompt-args",
      error: { code: -32602, message: "prompt arguments must be string values" }
    });
  });

  it("rejects non-object prompt arguments", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "prompt-args-object",
      method: "prompts/get",
      params: { name: "jmeter_plan_review", arguments: "not-an-object" }
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "prompt-args-object",
      error: { code: -32602, message: "prompt arguments must be an object when present" }
    });
  });

  it("returns JSON-RPC errors for malformed or invalid requests", async () => {
    await expect(handleJsonRpcMessage("{", server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: expect.objectContaining({ code: -32700 })
    });

    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "missing" }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32601, message: "Method not found: missing" }
    });

    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: {}, method: "ping" }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "id must be a string or number when present" }
    });

    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: {} }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602, message: "name is required" }
    });
  });
});

describe("stateful stdio MCP lifecycle", () => {
  it("rejects tools before initialize and initialized notification", async () => {
    const session = new JsonRpcMcpSession(server, runtime);

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "ping", method: "ping" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "ping",
      result: {}
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "tools",
      error: { code: -32002, message: "Server is not initialized" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize", params: initializeParams }))).resolves.toEqual(expect.objectContaining({
      jsonrpc: "2.0",
      id: "init",
      result: expect.objectContaining({ serverInfo: expect.objectContaining({ name: "jmxpls" }) })
    }));

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "blocked", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "blocked",
      error: { code: -32002, message: "Server is not initialized" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "early-shutdown", method: "shutdown" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "early-shutdown",
      error: { code: -32002, message: "Server is not initialized" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "ping2", method: "ping" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "ping2",
      result: {}
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).resolves.toBeUndefined();
    expect((await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "ready", method: "tools/list" })))?.result).toEqual(expect.objectContaining({ tools: expect.any(Array) }));
  });

  it("ignores non-standard exit notifications and keeps the session ready", async () => {
    const session = new JsonRpcMcpSession(server, runtime);
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize", params: initializeParams }));
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "shutdown", method: "shutdown" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "shutdown",
      error: { code: -32601, message: "Method not found: shutdown" }
    });
    expect(session.shouldClose).toBe(false);

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "exit" }))).resolves.toBeUndefined();
    expect(session.shouldClose).toBe(false);

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "tools",
      result: expect.objectContaining({ tools: expect.any(Array) })
    });
  });
});
