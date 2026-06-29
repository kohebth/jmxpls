import { MUTATION_TOOL_INPUT_SCHEMAS } from "./input-schemas.js";
import type { ToolRegistry } from "./registry.js";

const MUTATION_TOOLS = [
  "add_node",
  "update_node_field",
  "delete_node",
  "move_node",
  "clone_node",
  "enable_node",
  "disable_node",
  "apply_semantic_patch"
];

export function registerMutationTools(registry: ToolRegistry): void {
  for (const name of MUTATION_TOOLS) {
    registry.register({
      name,
      description: `Mutation tool with dry-run, diff, validation, and rollback support: ${name}`,
      inputSchema: MUTATION_TOOL_INPUT_SCHEMAS[name] ?? { type: "object", additionalProperties: true }
    });
  }
}
