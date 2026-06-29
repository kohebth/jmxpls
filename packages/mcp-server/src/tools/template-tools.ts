import type { ToolRegistry } from "./registry.js";

const TEMPLATE_TOOLS = ["list_templates", "get_template", "instantiate_template", "create_http_api_plan", "create_login_flow", "create_bearer_token_flow", "create_crud_flow", "create_csv_driven_flow", "prepare_plan_for_ci", "convert_hardcoded_values_to_variables", "disable_gui_only_listeners"];

export function registerTemplateTools(registry: ToolRegistry): void {
  for (const name of TEMPLATE_TOOLS) {
    registry.register({ name, description: `Template tool: ${name}`, inputSchema: { type: "object", additionalProperties: true } });
  }
}
