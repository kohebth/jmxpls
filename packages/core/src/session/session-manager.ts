import { randomUUID } from "node:crypto";

import { parseHashTreeDocument } from "../jmx/hash-tree-parser.js";
import { loadSidecar } from "../jmx/sidecar-store.js";
import { loadXmlFile } from "../xml/load-xml.js";
import { PlanSession } from "./plan-session.js";

export class SessionManager {
  private readonly sessions = new Map<string, PlanSession>();

  async openPlan(sourcePath: string): Promise<PlanSession> {
    const xml = await loadXmlFile(sourcePath);
    const canonical = parseHashTreeDocument(xml);
    const sidecar = await loadSidecar(sourcePath);
    const state = {
      planId: randomUUID(),
      sourcePath,
      openedAt: new Date().toISOString(),
      dirty: false,
      canonical,
      diagnostics: [...canonical.diagnostics, ...sidecar.diagnostics]
    };
    const session = new PlanSession(sidecar.sidecar ? { ...state, sidecar: sidecar.sidecar } : state);

    this.sessions.set(session.planId, session);
    return session;
  }

  closePlan(planId: string): boolean {
    return this.sessions.delete(planId);
  }

  get(planId: string): PlanSession | undefined {
    return this.sessions.get(planId);
  }

  listOpenPlans() {
    return [...this.sessions.values()].map((session) => session.summary());
  }

  clear(): void {
    this.sessions.clear();
  }
}
