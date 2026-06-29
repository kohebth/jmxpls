export type JsonSchema = Record<string, unknown>;

export const ANY_OBJECT_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: true
};

const NON_EMPTY_STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const INTEGER = { type: "integer" };
const OBJECT = { type: "object", additionalProperties: true };
const ARRAY = { type: "array" };
const ANY = {};

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): JsonSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    ...extra
  };
}

const PLAN_ID = { planId: NON_EMPTY_STRING };
const NODE_ID = { nodeId: NON_EMPTY_STRING };
const PATCH_FLAGS = { dryRun: BOOLEAN, validate: BOOLEAN };
const PLAN_LANGUAGE_OPTIONS = {
  mode: { type: "string", enum: ["outline", "flow", "semantic", "full"] },
  format: { type: "string", enum: ["object", "json", "yaml"] }
};

export const SESSION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  open_plan: objectSchema({ path: NON_EMPTY_STRING }, ["path"]),
  close_plan: objectSchema(PLAN_ID, ["planId"]),
  reload_plan: objectSchema(PLAN_ID, ["planId"]),
  save_plan: objectSchema({ ...PLAN_ID, path: NON_EMPTY_STRING, backup: BOOLEAN }, ["planId"]),
  save_plan_as: objectSchema({ ...PLAN_ID, path: NON_EMPTY_STRING, backup: BOOLEAN }, ["planId", "path"]),
  list_open_plans: objectSchema({}),
  summarize_plan: objectSchema(PLAN_ID, ["planId"]),
  list_tree: objectSchema(PLAN_ID, ["planId"]),
  get_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"])
};

export const QUERY_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  find_nodes: objectSchema({
    ...PLAN_ID,
    role: NON_EMPTY_STRING,
    type: NON_EMPTY_STRING,
    name: NON_EMPTY_STRING,
    enabled: BOOLEAN
  }, ["planId"]),
  find_by_variable: objectSchema({ ...PLAN_ID, variable: NON_EMPTY_STRING }, ["planId", "variable"]),
  find_by_request: objectSchema({
    ...PLAN_ID,
    method: NON_EMPTY_STRING,
    path: NON_EMPTY_STRING,
    pathContains: NON_EMPTY_STRING,
    domain: NON_EMPTY_STRING,
    domainContains: NON_EMPTY_STRING
  }, ["planId"]),
  find_disabled_nodes: objectSchema(PLAN_ID, ["planId"]),
  explain_execution_flow: objectSchema(PLAN_ID, ["planId"])
};

export const PLAN_LANGUAGE_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  get_plan_language: objectSchema({ ...PLAN_ID, ...PLAN_LANGUAGE_OPTIONS }, ["planId"]),
  export_plan_language: objectSchema({ ...PLAN_ID, ...PLAN_LANGUAGE_OPTIONS }, ["planId"]),
  validate_plan_language: objectSchema({ text: NON_EMPTY_STRING }, ["text"]),
  roundtrip_plan_language: objectSchema(PLAN_ID, ["planId"]),
  explain_plan_language: objectSchema({ ...PLAN_ID, text: NON_EMPTY_STRING }, [], { anyOf: [{ required: ["planId"] }, { required: ["text"] }] }),
  compare_plan_language: objectSchema({ left: NON_EMPTY_STRING, right: NON_EMPTY_STRING }, ["left", "right"])
};

export const MUTATION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_node: objectSchema({
    ...PLAN_ID,
    parentNodeId: NON_EMPTY_STRING,
    parentId: NON_EMPTY_STRING,
    nodeType: NON_EMPTY_STRING,
    type: NON_EMPTY_STRING,
    fields: OBJECT,
    index: INTEGER,
    ...PATCH_FLAGS
  }, ["planId"], {
    allOf: [
      { anyOf: [{ required: ["parentNodeId"] }, { required: ["parentId"] }] },
      { anyOf: [{ required: ["nodeType"] }, { required: ["type"] }] }
    ]
  }),
  update_node_field: objectSchema({
    ...PLAN_ID,
    ...NODE_ID,
    fieldPath: NON_EMPTY_STRING,
    field: NON_EMPTY_STRING,
    value: ANY,
    ...PATCH_FLAGS
  }, ["planId", "nodeId"], { anyOf: [{ required: ["fieldPath"] }, { required: ["field"] }] }),
  delete_node: objectSchema({ ...PLAN_ID, ...NODE_ID, ...PATCH_FLAGS }, ["planId", "nodeId"]),
  move_node: objectSchema({
    ...PLAN_ID,
    ...NODE_ID,
    toParentNodeId: NON_EMPTY_STRING,
    parentNodeId: NON_EMPTY_STRING,
    parentId: NON_EMPTY_STRING,
    index: INTEGER,
    ...PATCH_FLAGS
  }, ["planId", "nodeId"], { anyOf: [{ required: ["toParentNodeId"] }, { required: ["parentNodeId"] }, { required: ["parentId"] }] }),
  clone_node: objectSchema({
    ...PLAN_ID,
    ...NODE_ID,
    toParentNodeId: NON_EMPTY_STRING,
    parentNodeId: NON_EMPTY_STRING,
    parentId: NON_EMPTY_STRING,
    index: INTEGER,
    ...PATCH_FLAGS
  }, ["planId", "nodeId"], { anyOf: [{ required: ["toParentNodeId"] }, { required: ["parentNodeId"] }, { required: ["parentId"] }] }),
  enable_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]),
  disable_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]),
  apply_semantic_patch: objectSchema({
    ...PLAN_ID,
    patch: OBJECT,
    operations: ARRAY,
    ...PATCH_FLAGS
  }, ["planId"], { anyOf: [{ required: ["patch"] }, { required: ["operations"] }] })
};

export const VALIDATION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  validate_plan: objectSchema(PLAN_ID, ["planId"])
};
