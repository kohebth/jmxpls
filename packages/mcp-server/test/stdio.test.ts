import { describe, expect, it } from "vitest";

import { createJmxplsServer } from "../src/server.js";
import { handleJsonRpcMessage, resolvePromptTemplate } from "../src/transports/stdio.js";

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

  it("does not respond to initialized notifications", async () => {
    await expect(handleJsonRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    }), server, runtime)).resolves.toBeUndefined();
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

    await expect(handleJsonRpcMessage(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: {} }), server, runtime)).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32602, message: "name is required" }
    });
  });
});
