import type { ToolRegistry } from "./registry.js";

const STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const OBJECT = { type: "object", additionalProperties: true };
const ARRAY = { type: "array" };
const PLAN_ID = { planId: STRING };
const NODE_ID = { nodeId: STRING };

const RAW_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_raw_element: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]),
  get_raw_properties: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]),
  add_raw_element: objectSchema({ ...PLAN_ID, parentNodeId: STRING, parentId: STRING, nodeType: STRING, type: STRING, fields: OBJECT, dryRun: BOOLEAN, validate: BOOLEAN }, ["planId"], { allOf: [{ anyOf: [{ required: ["parentNodeId"] }, { required: ["parentId"] }] }, { anyOf: [{ required: ["nodeType"] }, { required: ["type"] }] }] }),
  update_raw_property: objectSchema({ ...PLAN_ID, ...NODE_ID, propertyPath: STRING, property: STRING, fieldPath: STRING, value: {}, dryRun: BOOLEAN, validate: BOOLEAN }, ["planId", "nodeId"], { anyOf: [{ required: ["propertyPath"] }, { required: ["property"] }, { required: ["fieldPath"] }] }),
  replace_raw_element: objectSchema({ ...PLAN_ID, ...NODE_ID, fields: OBJECT, dryRun: BOOLEAN, validate: BOOLEAN }, ["planId", "nodeId", "fields"]),
  validate_raw_patch: objectSchema({ patch: OBJECT, operations: ARRAY }, [], { anyOf: [{ required: ["patch"] }, { required: ["operations"] }] }),
  generate_raw_template: objectSchema({ nodeType: STRING, type: STRING, guiClass: STRING, name: STRING, enabled: BOOLEAN, fields: OBJECT }, [], { anyOf: [{ required: ["nodeType"] }, { required: ["type"] }] })
};

export function registerRawTools(registry: ToolRegistry): void {
  for (const [name, inputSchema] of Object.entries(RAW_TOOL_SCHEMAS)) {
    registry.register({ name, description: `Raw full-fidelity JMX tool: ${name}`, inputSchema });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
