import type { SemanticRole } from "./semantic.js";

export type ComponentDescriptor = {
  type: string;
  role: SemanticRole;
  displayName: string;
  xmlTags: string[];
  testClasses: string[];
  guiClasses: string[];
  fields: ComponentFieldDescriptor[];
};

export type ComponentFieldDescriptor = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  description?: string;
};

export type ComponentCatalog = {
  version: 1;
  source: "built-in" | "dynamic" | "merged";
  components: ComponentDescriptor[];
};
