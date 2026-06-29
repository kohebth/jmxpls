import { randomUUID } from "node:crypto";

export type RunStatus = "created" | "running" | "completed" | "failed" | "stopped";

export type RunRecord = {
  runId: string;
  status: RunStatus;
  logs: string[];
  artifacts: string[];
};

export class RunManager {
  private readonly runs = new Map<string, RunRecord>();

  create(): RunRecord {
    const run = { runId: randomUUID(), status: "created" as const, logs: [], artifacts: [] };
    this.runs.set(run.runId, run);
    return run;
  }

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  stop(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run) {
      return false;
    }
    run.status = "stopped";
    return true;
  }
}
