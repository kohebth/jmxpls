import { httpApiBaselineTemplate, httpApiLoginBearerTokenTemplate } from "./http-api.js";
import { csvDrivenLoginFlowTemplate } from "./login-flow.js";
import { backendListenerInfluxDbProfileTemplate, blankTestPlanTemplate, crudApiFlowTemplate, jdbcQueryTestTemplate, jmeterCiArtifactProfileTemplate, jmsPointToPointTestTemplate, tcpSmokeTestTemplate } from "./template-scenarios.js";
import { loadProfileTemplates } from "./load-profiles.js";
import { TemplateRegistry } from "./registry.js";

export function createBuiltInTemplateRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();
  for (const template of [
    blankTestPlanTemplate,
    httpApiBaselineTemplate,
    httpApiLoginBearerTokenTemplate,
    csvDrivenLoginFlowTemplate,
    crudApiFlowTemplate,
    jmeterCiArtifactProfileTemplate,
    backendListenerInfluxDbProfileTemplate,
    jdbcQueryTestTemplate,
    jmsPointToPointTestTemplate,
    tcpSmokeTestTemplate,
    ...loadProfileTemplates
  ]) {
    registry.register(template);
  }
  return registry;
}
