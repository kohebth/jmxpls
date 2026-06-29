import type { PlanTemplate } from "./registry.js";

export const csvDrivenLoginFlowTemplate: PlanTemplate = {
  name: "csv_driven_login_flow",
  description: "CSV-driven login flow template.",
  instantiate: () => ({ dryRun: true, operations: [] })
};
