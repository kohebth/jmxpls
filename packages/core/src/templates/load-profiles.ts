import type { PlanTemplate } from "./registry.js";

export const loadProfileTemplates: PlanTemplate[] = ["constant_load_profile", "ramp_load_profile", "spike_load_profile", "stress_load_profile", "soak_load_profile"].map((name) => ({
  name,
  description: `${name} template`,
  instantiate: () => ({ dryRun: true, operations: [] })
}));
