import type { SourceRange } from "../model/diagnostics.js";

export type SourcePosition = {
  line: number;
  column: number;
};

export function sourceRange(start: SourcePosition, end: SourcePosition): SourceRange {
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  };
}

export function currentPosition(line: number, column: number): SourcePosition {
  return {
    line: Math.max(1, line),
    column: Math.max(1, column)
  };
}
