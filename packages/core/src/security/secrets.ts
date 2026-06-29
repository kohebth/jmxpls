const SECRET_PATTERN = /(password|secret|token|apikey|api_key|authorization)/i;

export function isSecretLikeKey(key: string): boolean {
  return SECRET_PATTERN.test(key);
}
