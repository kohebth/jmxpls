import type { ToolRegistry } from "../registry.js";

const HTTP_TOOLS = ["add_http_request", "add_http_defaults", "add_header_manager", "add_cookie_manager", "add_cache_manager", "add_auth_manager"];

export function registerHttpTools(registry: ToolRegistry): void {
  for (const name of HTTP_TOOLS) {
    registry.register({
      name,
      description: `Typed HTTP JMeter tool: ${name}`,
      inputSchema: { type: "object", additionalProperties: true }
    });
  }
}
