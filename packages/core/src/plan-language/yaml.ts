import type { PlanLanguageDocument } from "./types.js";
import { load } from "js-yaml";

export function planLanguageToYaml(document: PlanLanguageDocument): string {
  return toYamlValue(document, 0);
}

export function planLanguageFromYaml(text: string): PlanLanguageDocument {
  const parseYaml = load as (input: string) => unknown;
  const parsed = parseYaml(text);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid YAML Plan Language document.");
  }

  return parsed as PlanLanguageDocument;
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
    if (Array.isArray(value) && value.length === 0) {
      return "[]\n";
    }

    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => {
        if (Array.isArray(item) && item.length === 0) {
          return `${indent}${key}: []\n`;
        }

        return `${indent}${key}: ${formatYamlItem(item, depth + 1)}`;
      })
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
  if (value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
}
