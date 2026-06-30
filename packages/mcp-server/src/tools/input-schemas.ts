export type JsonSchema = Record<string, unknown>;

export const ANY_OBJECT_SCHEMA: JsonSchema = { type: "object", additionalProperties: true };

const NON_EMPTY_STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const INTEGER = { type: "integer" };
const NUMBER = { type: "number" };
const OBJECT = { type: "object", additionalProperties: true };
const ARRAY = { type: "array" };
const ANY = {};
const STRING_OR_NUMBER = { oneOf: [NON_EMPTY_STRING, NUMBER] };

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}

const PLAN_ID = { planId: NON_EMPTY_STRING };
const NODE_ID = { nodeId: NON_EMPTY_STRING };
const PARENT_ID = { parentNodeId: NON_EMPTY_STRING, parentId: NON_EMPTY_STRING };
const PARENT_ONE_OF = { anyOf: [{ required: ["parentNodeId"] }, { required: ["parentId"] }] };
const PATCH_FLAGS = { dryRun: BOOLEAN, validate: BOOLEAN };
const POSITION_AND_FLAGS = { enabled: BOOLEAN, index: INTEGER, ...PATCH_FLAGS };
const TYPED_ADD_BASE = { ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, ...POSITION_AND_FLAGS };
const HTTP_TARGET_FIELDS = { name: NON_EMPTY_STRING, protocol: NON_EMPTY_STRING, domain: NON_EMPTY_STRING, port: STRING_OR_NUMBER, path: NON_EMPTY_STRING };
const PLAN_LANGUAGE_OPTIONS = { mode: { type: "string", enum: ["outline", "flow", "semantic", "full"] }, format: { type: "string", enum: ["object", "json", "yaml"] } };
const PLAN_LANGUAGE_APPLY_OPTIONS = { mode: { type: "string", enum: ["replace", "merge", "patch"] }, dryRun: BOOLEAN, validate: BOOLEAN };
const SOURCE_TEXT_OR_PATH = { text: NON_EMPTY_STRING, path: NON_EMPTY_STRING };
const EXTRACTOR_BASE = { ...TYPED_ADD_BASE, variableName: NON_EMPTY_STRING, defaultValue: NON_EMPTY_STRING, matchNumber: STRING_OR_NUMBER };
const JSR223_FIELDS = { language: NON_EMPTY_STRING, script: NON_EMPTY_STRING, filename: NON_EMPTY_STRING, parameters: NON_EMPTY_STRING, cacheKey: NON_EMPTY_STRING };

export const SESSION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  open_plan: objectSchema({ path: NON_EMPTY_STRING }, ["path"]), close_plan: objectSchema(PLAN_ID, ["planId"]), reload_plan: objectSchema(PLAN_ID, ["planId"]), save_plan: objectSchema({ ...PLAN_ID, path: NON_EMPTY_STRING, backup: BOOLEAN }, ["planId"]), save_plan_as: objectSchema({ ...PLAN_ID, path: NON_EMPTY_STRING, backup: BOOLEAN }, ["planId", "path"]), list_open_plans: objectSchema({}), summarize_plan: objectSchema(PLAN_ID, ["planId"]), list_tree: objectSchema(PLAN_ID, ["planId"]), get_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"])
};

export const QUERY_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  find_nodes: objectSchema({ ...PLAN_ID, role: NON_EMPTY_STRING, type: NON_EMPTY_STRING, name: NON_EMPTY_STRING, enabled: BOOLEAN }, ["planId"]), find_by_variable: objectSchema({ ...PLAN_ID, variable: NON_EMPTY_STRING }, ["planId", "variable"]), find_by_request: objectSchema({ ...PLAN_ID, method: NON_EMPTY_STRING, path: NON_EMPTY_STRING, pathContains: NON_EMPTY_STRING, domain: NON_EMPTY_STRING, domainContains: NON_EMPTY_STRING }, ["planId"]), find_disabled_nodes: objectSchema(PLAN_ID, ["planId"]), explain_execution_flow: objectSchema(PLAN_ID, ["planId"])
};

export const PLAN_LANGUAGE_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  get_plan_language: objectSchema({ ...PLAN_ID, ...PLAN_LANGUAGE_OPTIONS }, ["planId"]),
  export_plan_language: objectSchema({ ...PLAN_ID, ...PLAN_LANGUAGE_OPTIONS }, ["planId"]),
  validate_plan_language: objectSchema({ text: NON_EMPTY_STRING }, ["text"]),
  parse_plan_language: objectSchema({ text: NON_EMPTY_STRING }, ["text"]),
  roundtrip_plan_language: objectSchema(PLAN_ID, ["planId"]),
  explain_plan_language: objectSchema({ ...PLAN_ID, text: NON_EMPTY_STRING }, [], { anyOf: [{ required: ["planId"] }, { required: ["text"] }] }),
  compare_plan_language: objectSchema({ left: NON_EMPTY_STRING, right: NON_EMPTY_STRING }, ["left", "right"]),
  import_plan_language: objectSchema({ ...SOURCE_TEXT_OR_PATH, targetPath: NON_EMPTY_STRING, ...PLAN_LANGUAGE_APPLY_OPTIONS }, [], { anyOf: [{ required: ["text"] }, { required: ["path"] }] }),
  apply_plan_language: objectSchema({ ...PLAN_ID, ...SOURCE_TEXT_OR_PATH, ...PLAN_LANGUAGE_APPLY_OPTIONS }, ["planId"], { anyOf: [{ required: ["text"] }, { required: ["path"] }] })
};

export const MUTATION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_node: objectSchema({ ...PLAN_ID, ...PARENT_ID, nodeType: NON_EMPTY_STRING, type: NON_EMPTY_STRING, fields: OBJECT, index: INTEGER, ...PATCH_FLAGS }, ["planId"], { allOf: [PARENT_ONE_OF, { anyOf: [{ required: ["nodeType"] }, { required: ["type"] }] }] }), update_node_field: objectSchema({ ...PLAN_ID, ...NODE_ID, fieldPath: NON_EMPTY_STRING, field: NON_EMPTY_STRING, value: ANY, ...PATCH_FLAGS }, ["planId", "nodeId"], { anyOf: [{ required: ["fieldPath"] }, { required: ["field"] }] }), delete_node: objectSchema({ ...PLAN_ID, ...NODE_ID, ...PATCH_FLAGS }, ["planId", "nodeId"]), move_node: objectSchema({ ...PLAN_ID, ...NODE_ID, toParentNodeId: NON_EMPTY_STRING, ...PARENT_ID, index: INTEGER, ...PATCH_FLAGS }, ["planId", "nodeId"], { anyOf: [{ required: ["toParentNodeId"] }, { required: ["parentNodeId"] }, { required: ["parentId"] }] }), clone_node: objectSchema({ ...PLAN_ID, ...NODE_ID, toParentNodeId: NON_EMPTY_STRING, ...PARENT_ID, index: INTEGER, ...PATCH_FLAGS }, ["planId", "nodeId"], { anyOf: [{ required: ["toParentNodeId"] }, { required: ["parentNodeId"] }, { required: ["parentId"] }] }), enable_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]), disable_node: objectSchema({ ...PLAN_ID, ...NODE_ID }, ["planId", "nodeId"]), apply_semantic_patch: objectSchema({ ...PLAN_ID, patch: OBJECT, operations: ARRAY, ...PATCH_FLAGS }, ["planId"], { anyOf: [{ required: ["patch"] }, { required: ["operations"] }] })
};

export const HTTP_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_http_request: objectSchema({ ...PLAN_ID, ...PARENT_ID, ...HTTP_TARGET_FIELDS, method: NON_EMPTY_STRING, body: NON_EMPTY_STRING, headers: OBJECT, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_http_defaults: objectSchema({ ...PLAN_ID, ...PARENT_ID, ...HTTP_TARGET_FIELDS, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_header_manager: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, headers: OBJECT, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_cookie_manager: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_cache_manager: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_auth_manager: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF)
};

export const DATA_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_user_variables: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, variables: OBJECT, ...POSITION_AND_FLAGS }, ["planId"], PARENT_ONE_OF), add_csv_data_set: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, filename: NON_EMPTY_STRING, variableNames: ARRAY, delimiter: NON_EMPTY_STRING, ignoreFirstLine: BOOLEAN, recycle: BOOLEAN, stopThread: BOOLEAN, shareMode: NON_EMPTY_STRING, ...POSITION_AND_FLAGS }, ["planId", "filename"], PARENT_ONE_OF), add_counter: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, variableName: NON_EMPTY_STRING, start: STRING_OR_NUMBER, end: STRING_OR_NUMBER, increment: STRING_OR_NUMBER, format: NON_EMPTY_STRING, perUser: BOOLEAN, resetOnThreadGroupIteration: BOOLEAN, ...POSITION_AND_FLAGS }, ["planId", "variableName"], PARENT_ONE_OF), add_random_variable: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, variableName: NON_EMPTY_STRING, minimumValue: STRING_OR_NUMBER, maximumValue: STRING_OR_NUMBER, outputFormat: NON_EMPTY_STRING, perThread: BOOLEAN, ...POSITION_AND_FLAGS }, ["planId", "variableName"], PARENT_ONE_OF), add_jdbc_data_source: objectSchema({ ...PLAN_ID, ...PARENT_ID, name: NON_EMPTY_STRING, dataSource: NON_EMPTY_STRING, dbUrl: NON_EMPTY_STRING, driver: NON_EMPTY_STRING, username: NON_EMPTY_STRING, password: NON_EMPTY_STRING, ...POSITION_AND_FLAGS }, ["planId", "dataSource"], PARENT_ONE_OF), convert_hardcoded_host_to_variable: objectSchema({ ...PLAN_ID, host: NON_EMPTY_STRING, variableName: NON_EMPTY_STRING, value: NON_EMPTY_STRING, dryRun: BOOLEAN, validate: BOOLEAN }, ["planId", "host", "variableName"])
};

export const SAMPLER_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_jdbc_sampler: objectSchema({ ...TYPED_ADD_BASE, dataSource: NON_EMPTY_STRING, query: NON_EMPTY_STRING, queryType: NON_EMPTY_STRING, parameters: NON_EMPTY_STRING, variableNames: ARRAY, resultVariable: NON_EMPTY_STRING }, ["planId", "dataSource", "query"], PARENT_ONE_OF), add_ftp_sampler: objectSchema({ ...TYPED_ADD_BASE, server: NON_EMPTY_STRING, remoteFile: NON_EMPTY_STRING, localFile: NON_EMPTY_STRING, action: NON_EMPTY_STRING, binaryMode: BOOLEAN }, ["planId", "server", "remoteFile"], PARENT_ONE_OF), add_tcp_sampler: objectSchema({ ...TYPED_ADD_BASE, server: NON_EMPTY_STRING, port: STRING_OR_NUMBER, text: NON_EMPTY_STRING, classname: NON_EMPTY_STRING, timeout: STRING_OR_NUMBER }, ["planId", "server", "port"], PARENT_ONE_OF), add_jms_sampler: objectSchema({ ...TYPED_ADD_BASE, destination: NON_EMPTY_STRING, message: NON_EMPTY_STRING, providerUrl: NON_EMPTY_STRING }, ["planId", "destination"], PARENT_ONE_OF), add_smtp_sampler: objectSchema({ ...TYPED_ADD_BASE, server: NON_EMPTY_STRING, recipient: NON_EMPTY_STRING, sender: NON_EMPTY_STRING, subject: NON_EMPTY_STRING, body: NON_EMPTY_STRING }, ["planId", "server", "recipient"], PARENT_ONE_OF), add_jsr223_sampler: objectSchema({ ...TYPED_ADD_BASE, ...JSR223_FIELDS }, ["planId"], PARENT_ONE_OF), add_debug_sampler: objectSchema({ ...TYPED_ADD_BASE, displayJMeterVariables: BOOLEAN, displayJMeterProperties: BOOLEAN, displaySystemProperties: BOOLEAN }, ["planId"], PARENT_ONE_OF)
};

export const TIMER_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_constant_timer: objectSchema({ ...TYPED_ADD_BASE, delayMs: STRING_OR_NUMBER }, ["planId"], PARENT_ONE_OF), add_random_timer: objectSchema({ ...TYPED_ADD_BASE, distribution: { type: "string", enum: ["uniform", "gaussian", "poisson"] }, delayMs: STRING_OR_NUMBER, rangeMs: STRING_OR_NUMBER, deviationMs: STRING_OR_NUMBER, lambdaMs: STRING_OR_NUMBER }, ["planId"], PARENT_ONE_OF), add_sync_timer: objectSchema({ ...TYPED_ADD_BASE, groupSize: STRING_OR_NUMBER, timeoutMs: STRING_OR_NUMBER }, ["planId", "groupSize"], PARENT_ONE_OF), add_throughput_timer: objectSchema({ ...TYPED_ADD_BASE, targetThroughput: STRING_OR_NUMBER, calcMode: STRING_OR_NUMBER, precise: BOOLEAN, throughputPeriod: STRING_OR_NUMBER, durationSeconds: STRING_OR_NUMBER, batchSize: STRING_OR_NUMBER, batchThreadDelay: STRING_OR_NUMBER }, ["planId", "targetThroughput"], PARENT_ONE_OF), add_jsr223_timer: objectSchema({ ...TYPED_ADD_BASE, ...JSR223_FIELDS }, ["planId"], PARENT_ONE_OF)
};

export const ASSERTION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_response_assertion: objectSchema({ ...TYPED_ADD_BASE, patterns: ARRAY, pattern: NON_EMPTY_STRING, field: NON_EMPTY_STRING, matchType: NON_EMPTY_STRING, invert: BOOLEAN }, ["planId"], { allOf: [PARENT_ONE_OF, { anyOf: [{ required: ["patterns"] }, { required: ["pattern"] }] }] }), add_json_assertion: objectSchema({ ...TYPED_ADD_BASE, jsonPath: NON_EMPTY_STRING, expectedValue: NON_EMPTY_STRING, validateJson: BOOLEAN, expectNull: BOOLEAN, invert: BOOLEAN, regex: BOOLEAN }, ["planId", "jsonPath"], PARENT_ONE_OF), add_xpath_assertion: objectSchema({ ...TYPED_ADD_BASE, xpath: NON_EMPTY_STRING, xpath2: BOOLEAN, validateXml: BOOLEAN, whitespace: BOOLEAN, tolerant: BOOLEAN, invert: BOOLEAN }, ["planId", "xpath"], PARENT_ONE_OF), add_duration_assertion: objectSchema({ ...TYPED_ADD_BASE, durationMs: STRING_OR_NUMBER }, ["planId", "durationMs"], PARENT_ONE_OF), add_size_assertion: objectSchema({ ...TYPED_ADD_BASE, sizeBytes: STRING_OR_NUMBER, operator: NON_EMPTY_STRING }, ["planId", "sizeBytes"], PARENT_ONE_OF), add_jsr223_assertion: objectSchema({ ...TYPED_ADD_BASE, ...JSR223_FIELDS }, ["planId"], PARENT_ONE_OF)
};

export const EXTRACTOR_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_regex_extractor: objectSchema({ ...EXTRACTOR_BASE, regex: NON_EMPTY_STRING, template: NON_EMPTY_STRING, source: NON_EMPTY_STRING }, ["planId", "variableName", "regex"], PARENT_ONE_OF), add_json_extractor: objectSchema({ ...EXTRACTOR_BASE, jsonPath: NON_EMPTY_STRING, concat: BOOLEAN }, ["planId", "variableName", "jsonPath"], PARENT_ONE_OF), add_boundary_extractor: objectSchema({ ...EXTRACTOR_BASE, leftBoundary: NON_EMPTY_STRING, rightBoundary: NON_EMPTY_STRING, source: NON_EMPTY_STRING }, ["planId", "variableName", "leftBoundary", "rightBoundary"], PARENT_ONE_OF), add_xpath_extractor: objectSchema({ ...EXTRACTOR_BASE, xpath: NON_EMPTY_STRING, xpath2: BOOLEAN, fragment: BOOLEAN, validateXml: BOOLEAN, whitespace: BOOLEAN, tolerant: BOOLEAN }, ["planId", "variableName", "xpath"], PARENT_ONE_OF), add_css_extractor: objectSchema({ ...EXTRACTOR_BASE, selector: NON_EMPTY_STRING, attribute: NON_EMPTY_STRING, implementation: NON_EMPTY_STRING }, ["planId", "variableName", "selector"], PARENT_ONE_OF)
};

export const PROCESSOR_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = {
  add_jsr223_preprocessor: objectSchema({ ...TYPED_ADD_BASE, ...JSR223_FIELDS }, ["planId"], PARENT_ONE_OF), add_jsr223_postprocessor: objectSchema({ ...TYPED_ADD_BASE, ...JSR223_FIELDS }, ["planId"], PARENT_ONE_OF), add_jdbc_preprocessor: objectSchema({ ...TYPED_ADD_BASE, dataSource: NON_EMPTY_STRING, query: NON_EMPTY_STRING, queryType: NON_EMPTY_STRING, parameters: NON_EMPTY_STRING, variableNames: ARRAY, resultVariable: NON_EMPTY_STRING }, ["planId", "dataSource", "query"], PARENT_ONE_OF), add_user_parameters: objectSchema({ ...TYPED_ADD_BASE, variables: OBJECT, perIteration: BOOLEAN }, ["planId", "variables"], PARENT_ONE_OF), add_url_rewriting_modifier: objectSchema({ ...TYPED_ADD_BASE, argumentName: NON_EMPTY_STRING, pathExtension: BOOLEAN, encode: BOOLEAN, cacheValue: BOOLEAN }, ["planId", "argumentName"], PARENT_ONE_OF)
};

export const VALIDATION_TOOL_INPUT_SCHEMAS: Record<string, JsonSchema> = { validate_plan: objectSchema(PLAN_ID, ["planId"]) };
