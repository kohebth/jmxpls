export type PromptDescriptor = {
  name: string;
  description: string;
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
  for (const name of ["jmeter_plan_review", "jmeter_plan_add_login_flow", "jmeter_plan_prepare_for_ci", "jmeter_plan_debug_failure", "jmeter_plan_extract_variables", "jmeter_plan_plugin_recovery", "jmeter_plan_from_openapi", "jmeter_plan_from_curl_collection"]) {
    registry.register({ name, description: `Prompt workflow: ${name}` });
  }
}
