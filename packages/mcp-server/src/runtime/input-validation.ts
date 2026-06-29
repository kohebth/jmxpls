export type ToolCallInput = Record<string, unknown>;

export type InputValidationResult = {
  valid: boolean;
  errors: string[];
};

type FieldType = "string" | "boolean" | "integer" | "object" | "array" | "stringOrNumber";

type FieldRule = {
  name: string;
  type: FieldType;
  enum?: string[];
};

type ToolInputRule = {
  required?: FieldRule[];
  optional?: FieldRule[];
  requiredOneOf?: FieldRule[][];
};

const PLAN_ID: FieldRule = { name: "planId", type: "string" };
const NODE_ID: FieldRule = { name: "nodeId", type: "string" };
const PARENT_ID_ALIASES: FieldRule[] = [{ name: "parentNodeId", type: "string" }, { name: "parentId", type: "string" }];
const NODE_TYPE_ALIASES: FieldRule[] = [{ name: "nodeType", type: "string" }, { name: "type", type: "string" }];
const PARENT_OPTIONALS: FieldRule[] = PARENT_ID_ALIASES;
const PATCH_OPTIONALS: FieldRule[] = [{ name: "dryRun", type: "boolean" }, { name: "validate", type: "boolean" }];
const HTTP_TARGET_OPTIONALS: FieldRule[] = [
  { name: "name", type: "string" },
  { name: "protocol", type: "string" },
  { name: "domain", type: "string" },
  { name: "port", type: "stringOrNumber" },
  { name: "path", type: "string" },
  { name: "enabled", type: "boolean" },
  { name: "index", type: "integer" },
  ...PATCH_OPTIONALS
];

const TOOL_INPUT_RULES: Record<string, ToolInputRule> = {
  open_plan: { required: [{ name: "path", type: "string" }] },
  reload_plan: { required: [PLAN_ID] },
  close_plan: { required: [PLAN_ID] },
  list_open_plans: {},
  summarize_plan: { required: [PLAN_ID] },
  list_tree: { required: [PLAN_ID] },
  get_node: { required: [PLAN_ID, NODE_ID] },
  find_nodes: {
    required: [PLAN_ID],
    optional: [
      { name: "role", type: "string" },
      { name: "type", type: "string" },
      { name: "name", type: "string" },
      { name: "enabled", type: "boolean" }
    ]
  },
  find_by_variable: { required: [PLAN_ID, { name: "variable", type: "string" }] },
  find_by_request: {
    required: [PLAN_ID],
    optional: [
      { name: "method", type: "string" },
      { name: "path", type: "string" },
      { name: "pathContains", type: "string" },
      { name: "domain", type: "string" },
      { name: "domainContains", type: "string" }
    ]
  },
  find_disabled_nodes: { required: [PLAN_ID] },
  explain_execution_flow: { required: [PLAN_ID] },
  get_plan_language: {
    required: [PLAN_ID],
    optional: [
      { name: "mode", type: "string", enum: ["outline", "flow", "semantic", "full"] },
      { name: "format", type: "string", enum: ["object", "json", "yaml"] }
    ]
  },
  export_plan_language: {
    required: [PLAN_ID],
    optional: [
      { name: "mode", type: "string", enum: ["outline", "flow", "semantic", "full"] },
      { name: "format", type: "string", enum: ["object", "json", "yaml"] }
    ]
  },
  validate_plan_language: { required: [{ name: "text", type: "string" }] },
  roundtrip_plan_language: { required: [PLAN_ID] },
  explain_plan_language: { requiredOneOf: [[PLAN_ID, { name: "text", type: "string" }]] },
  compare_plan_language: { required: [{ name: "left", type: "string" }, { name: "right", type: "string" }] },
  validate_plan: { required: [PLAN_ID] },
  add_node: {
    required: [PLAN_ID],
    requiredOneOf: [PARENT_ID_ALIASES, NODE_TYPE_ALIASES],
    optional: [...NODE_TYPE_ALIASES, { name: "fields", type: "object" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS]
  },
  update_node_field: {
    required: [PLAN_ID, NODE_ID],
    requiredOneOf: [[{ name: "fieldPath", type: "string" }, { name: "field", type: "string" }]],
    optional: PATCH_OPTIONALS
  },
  delete_node: { required: [PLAN_ID, NODE_ID], optional: PATCH_OPTIONALS },
  move_node: {
    required: [PLAN_ID, NODE_ID],
    requiredOneOf: [[{ name: "toParentNodeId", type: "string" }, ...PARENT_ID_ALIASES]],
    optional: [{ name: "index", type: "integer" }, ...PATCH_OPTIONALS]
  },
  clone_node: {
    required: [PLAN_ID, NODE_ID],
    requiredOneOf: [[{ name: "toParentNodeId", type: "string" }, ...PARENT_ID_ALIASES]],
    optional: [{ name: "index", type: "integer" }, ...PATCH_OPTIONALS]
  },
  enable_node: { required: [PLAN_ID, NODE_ID] },
  disable_node: { required: [PLAN_ID, NODE_ID] },
  apply_semantic_patch: {
    required: [PLAN_ID],
    requiredOneOf: [[{ name: "patch", type: "object" }, { name: "operations", type: "array" }]],
    optional: PATCH_OPTIONALS
  },
  add_http_request: {
    required: [PLAN_ID],
    requiredOneOf: [PARENT_ID_ALIASES],
    optional: [...PARENT_OPTIONALS, ...HTTP_TARGET_OPTIONALS, { name: "method", type: "string" }, { name: "body", type: "string" }, { name: "headers", type: "object" }]
  },
  add_http_defaults: {
    required: [PLAN_ID],
    requiredOneOf: [PARENT_ID_ALIASES],
    optional: [...PARENT_OPTIONALS, ...HTTP_TARGET_OPTIONALS]
  },
  add_header_manager: {
    required: [PLAN_ID],
    requiredOneOf: [PARENT_ID_ALIASES],
    optional: [...PARENT_OPTIONALS, { name: "name", type: "string" }, { name: "headers", type: "object" }, { name: "enabled", type: "boolean" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS]
  },
  add_cookie_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...PARENT_OPTIONALS, { name: "name", type: "string" }, { name: "enabled", type: "boolean" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  add_cache_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...PARENT_OPTIONALS, { name: "name", type: "string" }, { name: "enabled", type: "boolean" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  add_auth_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...PARENT_OPTIONALS, { name: "name", type: "string" }, { name: "enabled", type: "boolean" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  save_plan: { required: [PLAN_ID], optional: [{ name: "path", type: "string" }, { name: "backup", type: "boolean" }] },
  save_plan_as: { required: [PLAN_ID, { name: "path", type: "string" }], optional: [{ name: "backup", type: "boolean" }] }
};

export function validateToolInput(toolName: string, input: ToolCallInput): InputValidationResult {
  const rule = TOOL_INPUT_RULES[toolName];
  if (!rule) {
    return { valid: true, errors: [] };
  }

  const errors = [
    ...validateFields(input, rule.required ?? [], "required"),
    ...validateFields(input, rule.optional ?? [], "optional"),
    ...validateOneOf(input, rule.requiredOneOf ?? [])
  ];

  return { valid: errors.length === 0, errors };
}

function validateFields(input: ToolCallInput, fields: FieldRule[], mode: "required" | "optional"): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (!(field.name in input)) {
      if (mode === "required") {
        errors.push(`${field.name} is required`);
      }
      continue;
    }
    const error = validateField(input[field.name], field);
    if (error) {
      errors.push(`${field.name} ${error}`);
    }
  }
  return errors;
}

function validateOneOf(input: ToolCallInput, groups: FieldRule[][]): string[] {
  const errors: string[] = [];
  for (const group of groups) {
    const valid = group.some((field) => field.name in input && !validateField(input[field.name], field));
    if (!valid) {
      errors.push(`one of ${group.map((field) => field.name).join(", ")} is required`);
    }
  }
  return errors;
}

function validateField(value: unknown, field: FieldRule): string | undefined {
  if (field.type === "string") {
    if (typeof value !== "string" || value.length === 0) {
      return "must be a non-empty string";
    }
    if (field.enum && !field.enum.includes(value)) {
      return `must be one of ${field.enum.join(", ")}`;
    }
    return undefined;
  }
  if (field.type === "stringOrNumber") {
    return (typeof value === "string" && value.length > 0) || typeof value === "number" ? undefined : "must be a string or number";
  }
  if (field.type === "boolean") {
    return typeof value === "boolean" ? undefined : "must be a boolean";
  }
  if (field.type === "integer") {
    return typeof value === "number" && Number.isInteger(value) ? undefined : "must be an integer";
  }
  if (field.type === "object") {
    return value && typeof value === "object" && !Array.isArray(value) ? undefined : "must be an object";
  }
  if (field.type === "array") {
    return Array.isArray(value) ? undefined : "must be an array";
  }
  return undefined;
}
