import { PromptRegistry, registerBuiltInPrompts, type PromptDescriptor } from "./prompts/registry.js";
import { ResourceRegistry, type ResourceDescriptor } from "./resources/registry.js";
import { registerCatalogResources } from "./resources/catalog-resources.js";
import { registerDiffResources } from "./resources/diff-resources.js";
import { registerPlanResources } from "./resources/plan-resources.js";
import { registerRunResources } from "./resources/run-resources.js";
import { registerSecurityResources } from "./resources/security-resources.js";
import { registerCatalogTools } from "./tools/catalog-tools.js";
import { registerExecutionTools } from "./tools/execution-tools.js";
import { registerMutationTools } from "./tools/mutation-tools.js";
import { registerPlanLanguageTools } from "./tools/plan-language-tools.js";
import { registerQueryTools } from "./tools/query-tools.js";
import { registerRawTools } from "./tools/raw-tools.js";
import { ToolRegistry, type ToolDescriptor } from "./tools/registry.js";
import { registerSessionTools } from "./tools/session-tools.js";
import { registerTemplateTools } from "./tools/template-tools.js";
import { registerAssertionTools } from "./tools/typed/assertion-tools.js";
import { registerDataTools } from "./tools/typed/data-tools.js";
import { registerExtractorTools } from "./tools/typed/extractor-tools.js";
import { registerHttpTools } from "./tools/typed/http-tools.js";
import { registerListenerTools } from "./tools/typed/listener-tools.js";
import { registerProcessorTools } from "./tools/typed/processor-tools.js";
import { registerSamplerTools } from "./tools/typed/sampler-tools.js";
import { registerTimerTools } from "./tools/typed/timer-tools.js";
import { registerValidationTools } from "./tools/validation-tools.js";

export type JmxplsServer = {
  resources: ResourceDescriptor[];
  tools: ToolDescriptor[];
  prompts: PromptDescriptor[];
};

export function createJmxplsServer(): JmxplsServer {
  const resourceRegistry = new ResourceRegistry();
  const toolRegistry = new ToolRegistry();
  const promptRegistry = new PromptRegistry();

  registerPlanResources(resourceRegistry);
  registerCatalogResources(resourceRegistry);
  registerRunResources(resourceRegistry);
  registerDiffResources(resourceRegistry);
  registerSecurityResources(resourceRegistry);
  registerSessionTools(toolRegistry);
  registerQueryTools(toolRegistry);
  registerPlanLanguageTools(toolRegistry);
  registerMutationTools(toolRegistry);
  registerRawTools(toolRegistry);
  registerCatalogTools(toolRegistry);
  registerValidationTools(toolRegistry);
  registerExecutionTools(toolRegistry);
  registerTemplateTools(toolRegistry);
  registerHttpTools(toolRegistry);
  registerDataTools(toolRegistry);
  registerSamplerTools(toolRegistry);
  registerTimerTools(toolRegistry);
  registerAssertionTools(toolRegistry);
  registerExtractorTools(toolRegistry);
  registerProcessorTools(toolRegistry);
  registerListenerTools(toolRegistry);
  registerBuiltInPrompts(promptRegistry);

  return {
    resources: resourceRegistry.list(),
    tools: toolRegistry.list(),
    prompts: promptRegistry.list()
  };
}
