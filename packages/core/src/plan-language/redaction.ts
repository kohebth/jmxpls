import type { RedactionMode } from "./types.js";

const SECRET_KEY_PATTERN = /(password|passwd|secret|token|apikey|api_key|authorization)/i;

export function redactValue(key: string, value: unknown, mode: RedactionMode = "standard"): unknown {
  if (mode === "none") {
    return value;
  }

  if (SECRET_KEY_PATTERN.test(key)) {
    return "<redacted>";
  }

  if (mode === "strict" && typeof value === "string" && value.length > 80) {
    return "<redacted-long-value>";
  }

  return value;
}

export function redactFields(fields: Record<string, unknown>, mode: RedactionMode = "standard"): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redactValue(key, value, mode)]));
}
