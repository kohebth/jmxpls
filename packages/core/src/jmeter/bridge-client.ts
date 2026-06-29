import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

import type { ComponentCatalog } from "../model/catalog.js";
import type { Diagnostic } from "../model/diagnostics.js";

export type BridgeRequest = {
  id: string;
  command: string;
  [key: string]: unknown;
};

export type BridgeResponse<T = unknown> = {
  id: string;
  success: boolean;
  data?: T;
  diagnostics: Diagnostic[];
};

export type BridgeEnvironment = {
  javaVersion?: string;
  jmeterHome?: string;
  jmeterConfigured?: boolean;
};

export type BridgeJmxResult = {
  path: string;
  valid?: boolean;
  reason?: string;
};

export type BridgeClientOptions = {
  javaCommand?: string;
  jarPath: string;
  timeoutMs?: number;
};

export class BridgeClient {
  private process: ChildProcessWithoutNullStreams | undefined;

  constructor(private readonly options: BridgeClientOptions) {
  }

  async request<T>(request: BridgeRequest): Promise<BridgeResponse<T>> {
    const child = this.ensureProcess();
    const lineReader = createInterface({ input: child.stdout });
    const timeoutMs = this.options.timeoutMs ?? 10_000;

    child.stdin.write(`${JSON.stringify(request)}\n`);

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Bridge request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      lineReader.once("line", (line) => {
        clearTimeout(timeout);
        lineReader.close();
        resolve(JSON.parse(line) as BridgeResponse<T>);
      });

      child.once("error", (error) => {
        clearTimeout(timeout);
        lineReader.close();
        reject(error);
      });
    });
  }

  async ping(): Promise<BridgeResponse<{ pong: boolean }>> {
    return await this.request({ id: randomUUID(), command: "ping" });
  }

  async environment(): Promise<BridgeResponse<BridgeEnvironment>> {
    return await this.request({ id: randomUUID(), command: "environment" });
  }

  async componentCatalog(): Promise<BridgeResponse<ComponentCatalog>> {
    return await this.request({ id: randomUUID(), command: "componentCatalog" });
  }

  async loadJmx(path: string): Promise<BridgeResponse<BridgeJmxResult>> {
    return await this.request({ id: randomUUID(), command: "loadJmx", path });
  }

  async saveJmx(path: string): Promise<BridgeResponse<BridgeJmxResult>> {
    return await this.request({ id: randomUUID(), command: "saveJmx", path });
  }

  async validateJmx(path: string): Promise<BridgeResponse<BridgeJmxResult>> {
    return await this.request({ id: randomUUID(), command: "validateJmx", path });
  }

  async roundTripJmx(path: string): Promise<BridgeResponse<BridgeJmxResult>> {
    return await this.request({ id: randomUUID(), command: "roundTripJmx", path });
  }

  close(): void {
    this.process?.kill();
    this.process = undefined;
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process) {
      return this.process;
    }

    this.process = spawn(this.options.javaCommand ?? "java", ["-jar", this.options.jarPath]);
    return this.process;
  }
}
