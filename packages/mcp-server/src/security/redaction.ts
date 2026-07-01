const SECRET_PATTERN = /(password|secret|token|apikey|api_key|authorization)/i;

export function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, SECRET_PATTERN.test(key) ? "<redacted>" : redactNested(value)]));
}

function redactNested(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactNested);
  }
  if (value !== null && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>);
  }
  return value;
}
