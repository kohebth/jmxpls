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
const PATCH_OPTIONALS: FieldRule[] = [{ name: "dryRun", type: "boolean" }, { name: "validate", type: "boolean" }];
const PLAN_LANGUAGE_SOURCE_OPTIONAL: FieldRule[] = [{ name: "text", type: "string" }, { name: "path", type: "string" }];
const PLAN_LANGUAGE_APPLY_OPTIONALS: FieldRule[] = [
  { name: "mode", type: "string", enum: ["replace", "merge", "patch"] },
  ...PATCH_OPTIONALS
];
const PAGE_OPTIONALS: FieldRule[] = [{ name: "limit", type: "integer" }, { name: "cursor", type: "string" }, { name: "depth", type: "integer" }, { name: "byteBudget", type: "integer" }, { name: "subtreeNodeId", type: "string" }, { name: "nodeId", type: "string" }];
const POSITION_OPTIONALS: FieldRule[] = [{ name: "enabled", type: "boolean" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS];
const PARENT_OPTIONALS: FieldRule[] = PARENT_ID_ALIASES;
const HTTP_TARGET_OPTIONALS: FieldRule[] = [
  { name: "name", type: "string" },
  { name: "protocol", type: "string" },
  { name: "domain", type: "string" },
  { name: "port", type: "stringOrNumber" },
  { name: "path", type: "string" },
  ...POSITION_OPTIONALS
];
const TYPED_ADD_OPTIONALS: FieldRule[] = [...PARENT_OPTIONALS, { name: "name", type: "string" }, ...POSITION_OPTIONALS];
const TIMER_COMMON_OPTIONALS: FieldRule[] = [...TYPED_ADD_OPTIONALS, { name: "delayMs", type: "stringOrNumber" }];
const EXTRACTOR_OPTIONALS: FieldRule[] = [...TYPED_ADD_OPTIONALS, { name: "defaultValue", type: "string" }, { name: "matchNumber", type: "stringOrNumber" }];

const TOOL_INPUT_RULES: Record<string, ToolInputRule> = {
  open_plan: { required: [{ name: "path", type: "string" }] },
  reload_plan: { required: [PLAN_ID] },
  close_plan: { required: [PLAN_ID] },
  list_open_plans: {},
  summarize_plan: { required: [PLAN_ID] },
  list_tree: { required: [PLAN_ID], optional: PAGE_OPTIONALS },
  get_node: { required: [PLAN_ID, NODE_ID] },
  find_nodes: {
    required: [PLAN_ID],
    optional: [
      { name: "role", type: "string" },
      { name: "type", type: "string" },
      { name: "name", type: "string" },
      { name: "enabled", type: "boolean" },
      { name: "match", type: "string", enum: ["contains", "exact", "regex", "fuzzy"] },
      { name: "view", type: "string", enum: ["compact", "full", "raw"] },
      { name: "parentNodeId", type: "string" },
      ...PAGE_OPTIONALS
    ]
  },
  find_by_variable: { required: [PLAN_ID, { name: "variable", type: "string" }] },
  find_by_request: { required: [PLAN_ID], optional: [{ name: "method", type: "string" }, { name: "path", type: "string" }, { name: "pathContains", type: "string" }, { name: "domain", type: "string" }, { name: "domainContains", type: "string" }] },
  find_disabled_nodes: { required: [PLAN_ID] },
  explain_execution_flow: { required: [PLAN_ID] },
  get_plan_language: { required: [PLAN_ID], optional: [{ name: "mode", type: "string", enum: ["outline", "flow", "semantic", "full"] }, { name: "format", type: "string", enum: ["object", "json", "yaml"] }] },
  export_plan_language: { required: [PLAN_ID], optional: [{ name: "mode", type: "string", enum: ["outline", "flow", "semantic", "full"] }, { name: "format", type: "string", enum: ["object", "json", "yaml"] }] },
  validate_plan_language: { required: [{ name: "text", type: "string" }] },
  parse_plan_language: { required: [{ name: "text", type: "string" }] },
  import_plan_language: { requiredOneOf: [PLAN_LANGUAGE_SOURCE_OPTIONAL], optional: [{ name: "targetPath", type: "string" }, ...PLAN_LANGUAGE_APPLY_OPTIONALS] },
  apply_plan_language: { required: [PLAN_ID], requiredOneOf: [PLAN_LANGUAGE_SOURCE_OPTIONAL], optional: PLAN_LANGUAGE_APPLY_OPTIONALS },
  roundtrip_plan_language: { required: [PLAN_ID] },
  explain_plan_language: { requiredOneOf: [[PLAN_ID, { name: "text", type: "string" }]] },
  compare_plan_language: { required: [{ name: "left", type: "string" }, { name: "right", type: "string" }] },
  validate_plan: { required: [PLAN_ID] },
  add_node: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES, NODE_TYPE_ALIASES], optional: [...NODE_TYPE_ALIASES, { name: "fields", type: "object" }, { name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  update_node_field: { required: [PLAN_ID, NODE_ID], requiredOneOf: [[{ name: "fieldPath", type: "string" }, { name: "field", type: "string" }]], optional: PATCH_OPTIONALS },
  delete_node: { required: [PLAN_ID, NODE_ID], optional: PATCH_OPTIONALS },
  move_node: { required: [PLAN_ID, NODE_ID], requiredOneOf: [[{ name: "toParentNodeId", type: "string" }, ...PARENT_ID_ALIASES]], optional: [{ name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  clone_node: { required: [PLAN_ID, NODE_ID], requiredOneOf: [[{ name: "toParentNodeId", type: "string" }, ...PARENT_ID_ALIASES]], optional: [{ name: "index", type: "integer" }, ...PATCH_OPTIONALS] },
  enable_node: { required: [PLAN_ID, NODE_ID] },
  disable_node: { required: [PLAN_ID, NODE_ID] },
  apply_semantic_patch: { required: [PLAN_ID], requiredOneOf: [[{ name: "patch", type: "object" }, { name: "operations", type: "array" }]], optional: PATCH_OPTIONALS },
  add_http_request: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...PARENT_OPTIONALS, ...HTTP_TARGET_OPTIONALS, { name: "method", type: "string" }, { name: "body", type: "string" }, { name: "headers", type: "object" }] },
  add_http_defaults: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...PARENT_OPTIONALS, ...HTTP_TARGET_OPTIONALS] },
  add_header_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "headers", type: "object" }] },
  add_cookie_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: TYPED_ADD_OPTIONALS },
  add_cache_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: TYPED_ADD_OPTIONALS },
  add_auth_manager: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: TYPED_ADD_OPTIONALS },
  add_user_variables: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "variables", type: "object" }] },
  add_csv_data_set: { required: [PLAN_ID, { name: "filename", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "variableNames", type: "array" }, { name: "delimiter", type: "string" }, { name: "ignoreFirstLine", type: "boolean" }, { name: "recycle", type: "boolean" }, { name: "stopThread", type: "boolean" }, { name: "shareMode", type: "string" }] },
  add_counter: { required: [PLAN_ID, { name: "variableName", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "start", type: "stringOrNumber" }, { name: "end", type: "stringOrNumber" }, { name: "increment", type: "stringOrNumber" }, { name: "format", type: "string" }, { name: "perUser", type: "boolean" }, { name: "resetOnThreadGroupIteration", type: "boolean" }] },
  add_random_variable: { required: [PLAN_ID, { name: "variableName", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "minimumValue", type: "stringOrNumber" }, { name: "maximumValue", type: "stringOrNumber" }, { name: "outputFormat", type: "string" }, { name: "perThread", type: "boolean" }] },
  add_jdbc_data_source: { required: [PLAN_ID, { name: "dataSource", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "dbUrl", type: "string" }, { name: "driver", type: "string" }, { name: "username", type: "string" }, { name: "password", type: "string" }] },
  convert_hardcoded_host_to_variable: { required: [PLAN_ID, { name: "host", type: "string" }, { name: "variableName", type: "string" }], optional: PATCH_OPTIONALS },
  add_jdbc_sampler: { required: [PLAN_ID, { name: "dataSource", type: "string" }, { name: "query", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "queryType", type: "string" }, { name: "parameters", type: "string" }, { name: "variableNames", type: "array" }, { name: "resultVariable", type: "string" }] },
  add_ftp_sampler: { required: [PLAN_ID, { name: "server", type: "string" }, { name: "remoteFile", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "localFile", type: "string" }, { name: "action", type: "string" }, { name: "binaryMode", type: "boolean" }] },
  add_tcp_sampler: { required: [PLAN_ID, { name: "server", type: "string" }, { name: "port", type: "stringOrNumber" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "text", type: "string" }, { name: "classname", type: "string" }, { name: "timeout", type: "stringOrNumber" }] },
  add_jms_sampler: { required: [PLAN_ID, { name: "destination", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "message", type: "string" }, { name: "providerUrl", type: "string" }] },
  add_smtp_sampler: { required: [PLAN_ID, { name: "server", type: "string" }, { name: "recipient", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "sender", type: "string" }, { name: "subject", type: "string" }, { name: "body", type: "string" }] },
  add_jsr223_sampler: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "language", type: "string" }, { name: "script", type: "string" }, { name: "filename", type: "string" }, { name: "parameters", type: "string" }] },
  add_debug_sampler: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "displayJMeterVariables", type: "boolean" }, { name: "displayJMeterProperties", type: "boolean" }, { name: "displaySystemProperties", type: "boolean" }] },
  add_constant_timer: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: TIMER_COMMON_OPTIONALS },
  add_random_timer: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TIMER_COMMON_OPTIONALS, { name: "distribution", type: "string", enum: ["uniform", "gaussian", "poisson"] }, { name: "rangeMs", type: "stringOrNumber" }, { name: "deviationMs", type: "stringOrNumber" }, { name: "lambdaMs", type: "stringOrNumber" }] },
  add_sync_timer: { required: [PLAN_ID, { name: "groupSize", type: "stringOrNumber" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "timeoutMs", type: "stringOrNumber" }] },
  add_throughput_timer: { required: [PLAN_ID, { name: "targetThroughput", type: "stringOrNumber" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "calcMode", type: "stringOrNumber" }, { name: "precise", type: "boolean" }, { name: "throughputPeriod", type: "stringOrNumber" }, { name: "durationSeconds", type: "stringOrNumber" }, { name: "batchSize", type: "stringOrNumber" }, { name: "batchThreadDelay", type: "stringOrNumber" }] },
  add_jsr223_timer: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "language", type: "string" }, { name: "script", type: "string" }, { name: "filename", type: "string" }, { name: "parameters", type: "string" }, { name: "cacheKey", type: "string" }] },
  add_response_assertion: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES, [{ name: "patterns", type: "array" }, { name: "pattern", type: "string" }]], optional: [...TYPED_ADD_OPTIONALS, { name: "field", type: "string" }, { name: "matchType", type: "string" }, { name: "invert", type: "boolean" }] },
  add_json_assertion: { required: [PLAN_ID, { name: "jsonPath", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "expectedValue", type: "string" }, { name: "validateJson", type: "boolean" }, { name: "expectNull", type: "boolean" }, { name: "invert", type: "boolean" }, { name: "regex", type: "boolean" }] },
  add_xpath_assertion: { required: [PLAN_ID, { name: "xpath", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "xpath2", type: "boolean" }, { name: "validateXml", type: "boolean" }, { name: "whitespace", type: "boolean" }, { name: "tolerant", type: "boolean" }, { name: "invert", type: "boolean" }] },
  add_duration_assertion: { required: [PLAN_ID, { name: "durationMs", type: "stringOrNumber" }], requiredOneOf: [PARENT_ID_ALIASES], optional: TYPED_ADD_OPTIONALS },
  add_size_assertion: { required: [PLAN_ID, { name: "sizeBytes", type: "stringOrNumber" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "operator", type: "string" }] },
  add_jsr223_assertion: { required: [PLAN_ID], requiredOneOf: [PARENT_ID_ALIASES], optional: [...TYPED_ADD_OPTIONALS, { name: "language", type: "string" }, { name: "script", type: "string" }, { name: "filename", type: "string" }, { name: "parameters", type: "string" }] },
  add_regex_extractor: { required: [PLAN_ID, { name: "variableName", type: "string" }, { name: "regex", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...EXTRACTOR_OPTIONALS, { name: "template", type: "string" }, { name: "source", type: "string" }] },
  add_json_extractor: { required: [PLAN_ID, { name: "variableName", type: "string" }, { name: "jsonPath", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...EXTRACTOR_OPTIONALS, { name: "concat", type: "boolean" }] },
  add_boundary_extractor: { required: [PLAN_ID, { name: "variableName", type: "string" }, { name: "leftBoundary", type: "string" }, { name: "rightBoundary", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...EXTRACTOR_OPTIONALS, { name: "source", type: "string" }] },
  add_xpath_extractor: { required: [PLAN_ID, { name: "variableName", type: "string" }, { name: "xpath", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...EXTRACTOR_OPTIONALS, { name: "xpath2", type: "boolean" }, { name: "fragment", type: "boolean" }, { name: "validateXml", type: "boolean" }, { name: "whitespace", type: "boolean" }, { name: "tolerant", type: "boolean" }] },
  add_css_extractor: { required: [PLAN_ID, { name: "variableName", type: "string" }, { name: "selector", type: "string" }], requiredOneOf: [PARENT_ID_ALIASES], optional: [...EXTRACTOR_OPTIONALS, { name: "attribute", type: "string" }, { name: "implementation", type: "string" }] },
  save_plan: { required: [PLAN_ID], optional: [{ name: "path", type: "string" }, { name: "backup", type: "boolean" }] },
  save_plan_as: { required: [PLAN_ID, { name: "path", type: "string" }], optional: [{ name: "backup", type: "boolean" }] }
};

export function validateToolInput(toolName: string, input: ToolCallInput): InputValidationResult {
  const rule = TOOL_INPUT_RULES[toolName];
  if (!rule) {
    return { valid: true, errors: [] };
  }
  const errors = [...validateFields(input, rule.required ?? [], "required"), ...validateFields(input, rule.optional ?? [], "optional"), ...validateOneOf(input, rule.requiredOneOf ?? [])];
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
