const SECRET_PATTERN = /(password|secret|token|apikey|api_key|authorization)/i;

export function redactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, SECRET_PATTERN.test(key) ? "<redacted>" : value]));
}
