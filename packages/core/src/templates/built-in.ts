import { httpApiBaselineTemplate, httpApiLoginBearerTokenTemplate } from "./http-api.js";
import { csvDrivenLoginFlowTemplate } from "./login-flow.js";
import { loadProfileTemplates } from "./load-profiles.js";
import { TemplateRegistry } from "./registry.js";

export function createBuiltInTemplateRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();
  for (const template of [httpApiBaselineTemplate, httpApiLoginBearerTokenTemplate, csvDrivenLoginFlowTemplate, ...loadProfileTemplates]) {
    registry.register(template);
  }
  return registry;
}
