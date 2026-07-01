export type PromptArgumentDescriptor = {
  name: string;
  description?: string;
  required?: boolean;
};

export type PromptDescriptor = {
  name: string;
  description: string;
  content: string;
  arguments?: Array<string | PromptArgumentDescriptor>;
};

export class PromptRegistry {
  private readonly prompts = new Map<string, PromptDescriptor>();

  register(prompt: PromptDescriptor): void {
    this.prompts.set(prompt.name, prompt);
  }

  list(): PromptDescriptor[] {
    return [...this.prompts.values()];
  }
}

export function registerBuiltInPrompts(registry: PromptRegistry): void {
  for (const descriptor of [
    {
      name: "jmeter_plan_review",
      description: "Review a plan for readiness before save.",
      content: "Inspect compact plan resources first (`plan-language/outline`, `summary`, and `diff`), then call `validate_plan` and, if needed, `validate_with_jmeter` before `save_plan`. Keep changes minimal and rollbackable."
    },
    {
      name: "jmeter_plan_add_login_flow",
      description: "Add authenticated login + token extraction flow.",
      content: "Create a thread group for authentication first, then add a token extractor and authenticated request chain. Keep credentials in variables and prefer reusable named components."
    },
    {
      name: "jmeter_plan_prepare_for_ci",
      description: "Prepare an existing plan for CI execution.",
      content: "Remove or disable GUI-only listeners (View Results Tree, Debug elements), replace hard-coded hosts with variables, run `validate_plan` and `validate_with_jmeter` and report risk items before save."
    },
    {
      name: "jmeter_plan_debug_failure",
      description: "Create a focused debug plan when validation fails.",
      content: "Capture the failing subtree with a minimal thread group, add focused assertions/logging, and keep the rest of the plan unchanged. Prefer dry-run mutations and report the first failing node path."
    },
    {
      name: "jmeter_plan_extract_variables",
      description: "Extract reusable variables from hard-coded values.",
      content: "Identify host/port/path/credential literals, introduce plan variables using existing variable conventions, then apply variable references where those literals are currently used."
    },
    {
      name: "jmeter_plan_plugin_recovery",
      description: "Recover safely when plugin components are not yet supported.",
      content: "Convert unsupported components to raw-node-safe form where possible, validate save/reload behavior, and preserve unknown plugin nodes and their properties."
    },
    {
      name: "jmeter_plan_from_openapi",
      description: "Generate a candidate plan from OpenAPI input.",
      content: "Start from baseline HTTP sampler templates, preserve operation ordering, and use semantic patch preview for first-pass review."
    },
    {
      name: "jmeter_plan_from_curl_collection",
      description: "Generate a candidate plan from request capture.",
      content: "Convert captured requests into semantic nodes with stable names and shared variables, then group related requests into clear thread-group flow."
    }
  ]) {
    registry.register(descriptor);
  }
}
