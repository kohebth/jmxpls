const VARIABLE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g;

export function extractVariableReferences(text: string): string[] {
  return [...new Set([...text.matchAll(VARIABLE_PATTERN)].map((match) => match[1]).filter((value): value is string => Boolean(value)))];
}
