import { randomUUID } from "node:crypto";

import type { JMeterCommand } from "./jmeter-command.js";

export type RunStatus = "created" | "running" | "completed" | "failed" | "stopped";

export type RunRecord = {
  runId: string;
  status: RunStatus;
  logs: string[];
  artifacts: string[];
  createdAt: string;
  updatedAt: string;
  command?: JMeterCommand;
  process?: RunProcessResult;
};

export type RunProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  signal?: string | null;
  timedOut?: boolean;
  cancelled?: boolean;
};

export type CreateRunOptions = {
  status?: RunStatus;
  logs?: string[];
  artifacts?: string[];
  command?: JMeterCommand;
};

export class RunManager {
  private readonly runs = new Map<string, RunRecord>();

  create(options: CreateRunOptions = {}): RunRecord {
    const now = new Date().toISOString();
    const run: RunRecord = {
      runId: randomUUID(),
      status: options.status ?? "created",
      logs: [...(options.logs ?? [])],
      artifacts: [...(options.artifacts ?? [])],
      createdAt: now,
      updatedAt: now
    };
    if (options.command !== undefined) {
      run.command = options.command;
    }
    this.runs.set(run.runId, run);
    return run;
  }

  list(): RunRecord[] {
    return [...this.runs.values()];
  }

  get(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  setStatus(runId: string, status: RunStatus): RunRecord | undefined {
    const run = this.runs.get(runId);
    if (!run) {
      return undefined;
    }
    run.status = status;
    run.updatedAt = new Date().toISOString();
    return run;
  }

  appendLog(runId: string, message: string): RunRecord | undefined {
    const run = this.runs.get(runId);
    if (!run) {
      return undefined;
    }
    run.logs.push(message);
    run.updatedAt = new Date().toISOString();
    return run;
  }

  addArtifact(runId: string, path: string): RunRecord | undefined {
    const run = this.runs.get(runId);
    if (!run) {
      return undefined;
    }
    run.artifacts.push(path);
    run.updatedAt = new Date().toISOString();
    return run;
  }

  setProcessResult(runId: string, process: RunProcessResult): RunRecord | undefined {
    const run = this.runs.get(runId);
    if (!run) {
      return undefined;
    }
    run.process = process;
    run.updatedAt = new Date().toISOString();
    return run;
  }

  stop(runId: string): boolean {
    return this.setStatus(runId, "stopped") !== undefined;
  }
}
