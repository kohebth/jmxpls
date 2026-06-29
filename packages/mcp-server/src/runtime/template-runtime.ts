import { createBuiltInTemplateRegistry, type SemanticPatch } from "@jmxpls/core";

import type { JmxplsRuntime as BaseRuntime, ToolCallInput, ToolCallResult } from "./tool-runtime.js";

export class TemplateToolRuntime {
  private readonly templates = createBuiltInTemplateRegistry();

  async callTool(name: string, input: ToolCallInput, base: BaseRuntime): Promise<ToolCallResult | undefined> {
    try {
      switch (name) {
        case "list_templates": return this.listTemplates();
        case "get_template": return this.getTemplate(input);
        case "instantiate_template": return await this.instantiateTemplate(input, base);
        case "create_http_api_plan": return await this.instantiateNamed("http_api_baseline", input, base);
        case "create_login_flow":
        case "create_bearer_token_flow": return await this.instantiateNamed("http_api_login_bearer_token", input, base);
        case "create_csv_driven_flow": return await this.instantiateNamed("csv_driven_login_flow", input, base);
        case "create_crud_flow": return await this.instantiateNamed("http_api_baseline", input, base);
        case "prepare_plan_for_ci": return await base.callTool("disable_gui_only_listeners", input);
        case "convert_hardcoded_values_to_variables": return await convertHardcodedValues(input, base);
        default: return undefined;
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown template tool error" };
    }
  }

  private listTemplates(): ToolCallResult {
    return { success: true, data: this.templates.list().map((template) => ({ name: template.name, description: template.description })) };
  }

  private getTemplate(input: ToolCallInput): ToolCallResult {
    const name = requiredString(input, "name");
    const template = this.templates.get(name);
    return template ? { success: true, data: { name: template.name, description: template.description, patch: template.instantiate() } } : { success: false, error: `Unknown template: ${name}` };
  }

  private async instantiateTemplate(input: ToolCallInput, base: BaseRuntime): Promise<ToolCallResult> {
    return await this.instantiateNamed(requiredString(input, "name"), input, base);
  }

  private async instantiateNamed(name: string, input: ToolCallInput, base: BaseRuntime): Promise<ToolCallResult> {
    const template = this.templates.get(name);
    if (!template) {
      return { success: false, error: `Unknown template: ${name}` };
    }
    const patch = withPatchFlags(template.instantiate(), input);
    if (input.apply === true) {
      return await base.callTool("apply_semantic_patch", { planId: requiredString(input, "planId"), patch });
    }
    return { success: true, data: { name: template.name, description: template.description, patch } };
  }
}

async function convertHardcodedValues(input: ToolCallInput, base: BaseRuntime): Promise<ToolCallResult> {
  if (typeof input.host === "string" && typeof input.variableName === "string") {
    return await base.callTool("convert_hardcoded_host_to_variable", input);
  }
  return { success: false, error: "host and variableName are required for the current conversion implementation." };
}

function withPatchFlags(patch: SemanticPatch, input: ToolCallInput): SemanticPatch {
  return {
    ...patch,
    ...(typeof input.dryRun === "boolean" ? { dryRun: input.dryRun } : {}),
    ...(typeof input.validate === "boolean" ? { validate: input.validate } : {})
  };
}

function requiredString(input: ToolCallInput, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}
