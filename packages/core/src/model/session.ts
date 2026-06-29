import type { Diagnostic } from "./diagnostics.js";

export type PlanSessionSummary = {
  planId: string;
  sourcePath: string;
  revision: number;
  dirty: boolean;
  openedAt: string;
  diagnostics: Diagnostic[];
};

export type SessionSummary = {
  openPlans: PlanSessionSummary[];
};
