import { readFile } from "node:fs/promises";

import { loadBuiltInCatalog, mergeCatalogs, type ComponentCatalog, type ComponentDescriptor, type ComponentFieldDescriptor } from "@jmxpls/core";

import type { ToolCallInput, ToolCallResult } from "./tool-runtime.js";

export class CatalogToolRuntime {
  private catalog = loadBuiltInCatalog();

  readResource(uri: string): ToolCallResult | undefined {
    if (uri === "jmxpls://catalog") {
      return { success: true, data: this.catalog };
    }
    if (uri === "jmxpls://catalog/summary") {
      return { success: true, data: catalogSummary(this.catalog) };
    }
    if (uri === "jmxpls://catalog/types") {
      return { success: true, data: listComponents(this.catalog) };
    }
    const match = /^jmxpls:\/\/catalog\/types\/([^/]+)$/.exec(uri);
    if (!match) {
      return undefined;
    }
    const type = decodeURIComponent(match[1] ?? "");
    const descriptor = this.findDescriptor(type);
    return descriptor ? { success: true, data: descriptor } : { success: false, error: `Unknown component type: ${type}` };
  }

  async callTool(name: string, input: ToolCallInput): Promise<ToolCallResult | undefined> {
    try {
      switch (name) {
        case "load_component_catalog": return this.loadCatalog();
        case "refresh_component_catalog": return this.refreshCatalog();
        case "inspect_component_schema": return this.inspectSchema(input);
        case "list_component_types": return this.listTypes(input);
        case "get_component_defaults": return this.getDefaults(input);
        case "export_component_catalog": return { success: true, data: this.catalog };
        case "import_component_catalog": return await this.importCatalog(input);
        default: return undefined;
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown catalog tool error" };
    }
  }

  private loadCatalog(): ToolCallResult {
    this.catalog = loadBuiltInCatalog();
    return { success: true, data: catalogSummary(this.catalog) };
  }

  private refreshCatalog(): ToolCallResult {
    this.catalog = loadBuiltInCatalog();
    return { success: true, data: { refreshed: true, ...catalogSummary(this.catalog) } };
  }

  private inspectSchema(input: ToolCallInput): ToolCallResult {
    const descriptor = this.findDescriptor(requiredString(input, "type"));
    return descriptor ? { success: true, data: descriptor } : { success: false, error: `Unknown component type: ${String(input.type)}` };
  }

  private listTypes(input: ToolCallInput): ToolCallResult {
    const role = optionalString(input, "role");
    const components = listComponents(this.catalog).components.filter((component) => role ? component.role === role : true);
    return { success: true, data: { count: components.length, components } };
  }

  private getDefaults(input: ToolCallInput): ToolCallResult {
    const descriptor = this.findDescriptor(requiredString(input, "type"));
    if (!descriptor) {
      return { success: false, error: `Unknown component type: ${String(input.type)}` };
    }
    return { success: true, data: { type: descriptor.type, fields: defaultFields(descriptor) } };
  }

  private async importCatalog(input: ToolCallInput): Promise<ToolCallResult> {
    const imported = objectInput(input, "catalog") ?? await catalogFromPath(requiredString(input, "path"));
    if (!isComponentCatalog(imported)) {
      return { success: false, error: "Imported catalog does not match ComponentCatalog shape." };
    }
    this.catalog = mergeCatalogs(this.catalog, imported);
    return { success: true, data: catalogSummary(this.catalog) };
  }

  private findDescriptor(type: string): ComponentDescriptor | undefined {
    return this.catalog.components.find((component) => component.type === type);
  }
}

async function catalogFromPath(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

function catalogSummary(catalog: ComponentCatalog): Record<string, unknown> {
  const roles = catalog.components.reduce<Record<string, number>>((counts, component) => {
    counts[component.role] = (counts[component.role] ?? 0) + 1;
    return counts;
  }, {});
  return { version: catalog.version, source: catalog.source, count: catalog.components.length, roles };
}

function listComponents(catalog: ComponentCatalog): { count: number; components: Array<{ type: string; role: string; displayName: string }> } {
  const components = catalog.components.map((component) => ({ type: component.type, role: component.role, displayName: component.displayName }));
  return { count: components.length, components };
}

function defaultFields(descriptor: ComponentDescriptor): Record<string, unknown> {
  const fields: Record<string, unknown> = { name: descriptor.displayName, enabled: true };
  for (const field of descriptor.fields) {
    fields[field.name] = defaultValue(field);
  }
  return fields;
}

function defaultValue(field: ComponentFieldDescriptor): unknown {
  switch (field.type) {
    case "number": return 0;
    case "boolean": return false;
    case "array": return [];
    case "object": return {};
    case "string": return "";
  }
}

function isComponentCatalog(value: unknown): value is ComponentCatalog {
  return isObject(value) && value.version === 1 && Array.isArray(value.components);
}

function requiredString(input: ToolCallInput, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(input: ToolCallInput, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function objectInput(input: ToolCallInput, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  return isObject(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
