export type DiagnosticSeverity = "info" | "warning" | "error" | "fatal";

export type Diagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  nodeId?: string;
  jmxPath?: string;
  sourceRange?: SourceRange;
  fixSuggestion?: string;
};

export type SourceRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export function diagnostic(input: Diagnostic): Diagnostic {
  return input;
}
