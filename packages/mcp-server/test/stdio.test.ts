import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../src/server.js";
import { handleJsonRpcMessage, JsonRpcMcpSession, resolvePromptTemplate } from "../src/transports/stdio.js";

const server = createJmxplsServer();
const runtime = {
  callTool: async (name: string, input: Record<string, unknown>) => ({ success: true, data: { name, input } }),
  readResource: (uri: string) => ({ success: true, data: { uri, ok: true } })
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
      params: { protocolVersion: "1900-01-01" }
    }), server, runtime);

    expect(response?.result).toEqual(expect.objectContaining({
      protocolVersion: "2025-06-18"
    }));
  });

  it("does not respond to initialized notifications", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    }), server, runtime)).resolves.toBeUndefined();
  });

  it("accepts JSON-RPC null request ids", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      method: "ping"
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      result: {}
    });
  });

  it("responds to shutdown requests for clean stdio lifecycle shutdown", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: "shutdown",
      method: "shutdown"
    }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: "shutdown",
      result: {}
    });
  });

  it("lists tools, resources, resource templates, and prompts in MCP result wrappers", async () => {
    const tools = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "tools", method: "tools/list" }), server, runtime);
    expect((tools?.result as { tools: unknown[] }).tools.length).toBeGreaterThan(0);

    const resources = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "resources", method: "resources/list" }), server, runtime);
    expect((resources?.result as { resources: Array<{ uri: string }> }).resources.some((resource) => resource.uri === "jmxpls://plans")).toBe(true);

    const templates = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "templates", method: "resources/templates/list" }), server, runtime);
    expect((templates?.result as { resourceTemplates: Array<{ uriTemplate: string }> }).resourceTemplates.some((resource) => resource.uriTemplate === "jmxpls://plans/{planId}/summary")).toBe(true);

    const prompts = await handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: "prompts", method: "prompts/list" }), server, runtime);
    expect((prompts?.result as { prompts: Array<{ name: string; content?: string }> }).prompts.find((prompt) => prompt.name === "jmeter_plan_review")?.content).toBeUndefined();
  });

  it("handles JSON-RPC batch requests and omits notification responses", async () => {
    const response = await handleJsonRpcMessage(JSON.stringify([
      { jsonrpc: "2.0", id: "ping", method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: "tools", method: "tools/list" }
    ]), server, runtime);

    expect(response).toEqual([
      { jsonrpc: "2.0", id: "ping", result: {} },
      { jsonrpc: "2.0", id: "tools", result: { tools: expect.any(Array) } }
    ]);
  });

  it("returns no batch response when every item is a notification", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify([
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", method: "notifications/progress" }
    ]), server, runtime)).resolves.toBeUndefined();
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
        name: "echo",
        arguments: { value: 1 }
      }
    }), server, runtime);

    expect(response?.result).toEqual({
      content: [{ type: "text", text: expect.stringContaining("\"name\": \"echo\"") }],
      structuredContent: { success: true, data: { name: "echo", input: { value: 1 } } },
      isError: false
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
      error: { code: -32600, message: "id must be a string, number, or null when present" }
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

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize" }))).resolves.toEqual(expect.objectContaining({
      jsonrpc: "2.0",
      id: "init",
      result: expect.objectContaining({ serverInfo: expect.objectContaining({ name: "jmxpls" }) })
    }));

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "blocked", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "blocked",
      error: { code: -32002, message: "Server is not initialized" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "ping2", method: "ping" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "ping2",
      result: {}
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).resolves.toBeUndefined();
    expect((await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "ready", method: "tools/list" })))?.result).toEqual({ tools: expect.any(Array) });
  });

  it("enters shutdown state and closes only after exit notification", async () => {
    const session = new JsonRpcMcpSession(server, runtime);
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "init", method: "initialize" }));
    await session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "shutdown", method: "shutdown" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "shutdown",
      result: {}
    });
    expect(session.shouldClose).toBe(false);

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", id: "blocked", method: "tools/list" }))).resolves.toEqual({
      jsonrpc: "2.0",
      id: "blocked",
      error: { code: -32000, message: "Server is shutting down" }
    });

    await expect(session.handleMessage(JSON.stringify({ jsonrpc: "2.0", method: "exit" }))).resolves.toBeUndefined();
    expect(session.shouldClose).toBe(true);
  });
});
