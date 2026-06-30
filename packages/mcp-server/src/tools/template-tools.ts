import type { ToolRegistry } from "./registry.js";

const STRING = { type: "string", minLength: 1 };
const BOOLEAN = { type: "boolean" };
const NUMBER = { type: "number" };
const STRING_OR_NUMBER = { oneOf: [STRING, NUMBER] };
const PLAN_ID = { planId: STRING };
const PATCH_FLAGS = { dryRun: BOOLEAN, validate: BOOLEAN };
const TEMPLATE_OPTIONS = {
  idPrefix: STRING,
  protocol: STRING,
  domain: STRING,
  port: STRING_OR_NUMBER,
  path: STRING,
  method: STRING,
  threads: STRING_OR_NUMBER,
  rampSec: STRING_OR_NUMBER,
  rampUpSec: STRING_OR_NUMBER,
  loops: STRING_OR_NUMBER,
  threadGroupName: STRING,
  requestName: STRING,
  loginPath: STRING,
  loginMethod: STRING,
  loginBody: STRING,
  loginRequestName: STRING,
  authenticatedPath: STRING,
  authenticatedMethod: STRING,
  authenticatedRequestName: STRING,
  usernameVariable: STRING,
  passwordVariable: STRING,
  tokenVariable: STRING,
  tokenJsonPath: STRING,
  tokenDefault: STRING,
  authHeaderName: STRING,
  authHeaderPrefix: STRING,
  csvFilename: STRING,
  variableNames: STRING,
  delimiter: STRING,
  ignoreFirstLine: BOOLEAN,
  recycle: BOOLEAN,
  stopThread: BOOLEAN,
  shareMode: STRING,
  expectedStatus: STRING
};
const APPLY_OPTIONS = { ...PLAN_ID, parentNodeId: STRING, apply: BOOLEAN, ...PATCH_FLAGS };

const TEMPLATE_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  list_templates: objectSchema({}),
  get_template: objectSchema({ name: STRING }, ["name"]),
  instantiate_template: objectSchema({ name: STRING, ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }, ["name"]),
  create_http_api_plan: objectSchema({ ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }),
  create_login_flow: objectSchema({ ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }),
  create_bearer_token_flow: objectSchema({ ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }),
  create_crud_flow: objectSchema({ ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }),
  create_csv_driven_flow: objectSchema({ ...APPLY_OPTIONS, ...TEMPLATE_OPTIONS }),
  prepare_plan_for_ci: objectSchema(PLAN_ID, ["planId"]),
  convert_hardcoded_values_to_variables: objectSchema({ ...PLAN_ID, host: STRING, variableName: STRING, ...PATCH_FLAGS }, ["planId", "host", "variableName"]),
  disable_gui_only_listeners: objectSchema(PLAN_ID, ["planId"])
};

export function registerTemplateTools(registry: ToolRegistry): void {
  for (const [name, inputSchema] of Object.entries(TEMPLATE_TOOL_SCHEMAS)) {
    registry.register({ name, description: `Template tool: ${name}`, inputSchema });
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = [], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false, ...extra };
}
