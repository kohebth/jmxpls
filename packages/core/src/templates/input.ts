import type { TemplateInput } from "./registry.js";

export function stringInput(input: TemplateInput, key: string, fallback: string): string {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function numberInput(input: TemplateInput, key: string, fallback: number): number {
  const value = input[key];
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function booleanInput(input: TemplateInput, key: string, fallback: boolean): boolean {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  return value === "false" ? false : fallback;
}

export function scalarInput(input: TemplateInput, key: string): string | number | undefined {
  const value = input[key];
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
