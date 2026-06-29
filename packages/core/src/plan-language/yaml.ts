import type { PlanLanguageDocument } from "./types.js";

export function planLanguageToYaml(document: PlanLanguageDocument): string {
  return toYamlValue(document, 0);
}

function toYamlValue(value: unknown, depth: number): string {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]\n";
    }
    return value.map((item) => `${indent}- ${formatYamlItem(item, depth + 1)}`).join("");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${indent}${key}: ${formatYamlItem(item, depth + 1)}`)
      .join("");
  }

  return `${formatScalar(value)}\n`;
}

function formatYamlItem(value: unknown, depth: number): string {
  if (value && typeof value === "object") {
    return `\n${toYamlValue(value, depth)}`;
  }

  return `${formatScalar(value)}\n`;
}

function formatScalar(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}
