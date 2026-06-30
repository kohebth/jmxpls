import type { SemanticPatch } from "../model/patches.js";

export type TemplateInput = Record<string, unknown>;

export type TemplateParameter = {
  name: string;
  type: "string" | "number" | "boolean" | "stringOrNumber";
  description: string;
  defaultValue?: string | number | boolean;
  required?: boolean;
};

export type PlanTemplate = {
  name: string;
  description: string;
  parameters?: TemplateParameter[];
  instantiate: (input?: TemplateInput) => SemanticPatch;
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
