import type { Diagnostic } from "./diagnostics.js";

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type ToolResult<T> = {
  success: boolean;
  data?: T;
  diagnostics: Diagnostic[];
  meta?: ToolResultMeta;
};

export type ToolResultMeta = {
  planId?: string;
  revision?: number;
  dryRun?: boolean;
  elapsedMs?: number;
};

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function toolSuccess<T>(data: T, meta?: ToolResultMeta): ToolResult<T> {
  return meta ? { success: true, data, diagnostics: [], meta } : { success: true, data, diagnostics: [] };
}

export function toolFailure<T>(diagnostics: Diagnostic[], meta?: ToolResultMeta): ToolResult<T> {
  return meta ? { success: false, diagnostics, meta } : { success: false, diagnostics };
}
