import type { SemanticPatch } from "../model/patches.js";

export type PlanTemplate = {
  name: string;
  description: string;
  instantiate: () => SemanticPatch;
};

export class TemplateRegistry {
  private readonly templates = new Map<string, PlanTemplate>();

  register(template: PlanTemplate): void {
    this.templates.set(template.name, template);
  }

  list(): PlanTemplate[] {
    return [...this.templates.values()];
  }

  get(name: string): PlanTemplate | undefined {
    return this.templates.get(name);
  }
}
