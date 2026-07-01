import { randomUUID } from "node:crypto";

import type { HashTreeNode, JmxDocument } from "../model/canonical.js";
import type { SidecarDocument, SidecarNodeIdentity } from "../model/sidecar.js";
import { parseHashTreeDocument } from "../jmx/hash-tree-parser.js";
import { loadSidecar, reconcileSidecar } from "../jmx/sidecar-store.js";
import { buildSemanticPlan } from "../semantic/indexer.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";
import { loadXmlFile } from "../xml/load-xml.js";
import { PlanSession } from "./plan-session.js";

export class SessionManager {
  private readonly sessions = new Map<string, PlanSession>();

  async openPlan(sourcePath: string): Promise<PlanSession> {
    const xml = await loadXmlFile(sourcePath);
    const canonical = parseHashTreeDocument(xml);
    const sidecar = await loadSidecar(sourcePath);
    applySidecarIdentities(canonical, sidecar.sidecar);
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

function applySidecarIdentities(document: JmxDocument, sidecar: SidecarDocument | undefined): void {
  if (!document.root?.hashTree || !sidecar) {
    return;
  }
  const current = flattenSemanticNodes(buildSemanticPlan(document).root).map((node): SidecarNodeIdentity => ({
    nodeId: node.nodeId,
    jmxPath: node.path,
    fingerprint: node.nodeId,
    testName: node.name
  }));
  const replacements = new Map(reconcileSidecar(sidecar, current).map((node) => [node.fingerprint, node.nodeId]));
  replaceNodeIds(document.root.hashTree, replacements);
}

function replaceNodeIds(tree: HashTreeNode, replacements: Map<string, string>): void {
  for (const pair of tree.pairs) {
    pair.nodeId = replacements.get(pair.nodeId) ?? pair.nodeId;
    replaceNodeIds(pair.children, replacements);
  }
}
