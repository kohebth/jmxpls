import type { PlanTemplate } from "./registry.js";

export const httpApiBaselineTemplate: PlanTemplate = {
  name: "http_api_baseline",
  description: "Baseline HTTP API test plan patch.",
  instantiate: () => ({ dryRun: true, operations: [] })
};

export const httpApiLoginBearerTokenTemplate: PlanTemplate = {
  name: "http_api_login_bearer_token",
  description: "HTTP API login flow with bearer token extraction.",
  instantiate: () => ({ dryRun: true, operations: [] })
};
