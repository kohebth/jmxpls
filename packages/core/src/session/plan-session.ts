import type { JmxDocument } from "../model/canonical.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticDiff } from "../model/diff.js";
import type { SemanticPatch } from "../model/patches.js";
import type { SemanticPlan } from "../model/semantic.js";
import type { SidecarDocument } from "../model/sidecar.js";
import { applyCanonicalPatch } from "../patch/canonical-patch.js";
import { buildSemanticPlan } from "../semantic/indexer.js";
import { validatePlan, type ValidationResult } from "../validation/validator.js";
import { serializeJmxDocument } from "../jmx/hash-tree-serializer.js";
import { loadXml } from "../xml/load-xml.js";
import { parseHashTreeDocument } from "../jmx/hash-tree-parser.js";
import { atomicWriteFile } from "../io/atomic-writer.js";
import { backupFile } from "../io/backup.js";
import { RevisionLog } from "./revision-log.js";

export type PlanSessionState = {
  planId: string;
  sourcePath: string;
  openedAt: string;
  dirty: boolean;
  canonical: JmxDocument;
  diagnostics: Diagnostic[];
  sidecar?: SidecarDocument;
  latestDiff?: SemanticDiff;
};

export type SavePlanResult = {
  path: string;
  backupPath?: string;
  revision: number;
  validation: ValidationResult;
};

export class PlanSession {
  readonly revisions = new RevisionLog();

  constructor(private readonly state: PlanSessionState) {
  }

  get planId(): string {
    return this.state.planId;
  }

  get sourcePath(): string {
    return this.state.sourcePath;
  }

  get revision(): number {
    return this.revisions.current();
  }

  get dirty(): boolean {
    return this.state.dirty;
  }

  get canonical(): JmxDocument {
    return this.state.canonical;
  }

  get diagnostics(): Diagnostic[] {
    return this.state.diagnostics;
  }

  get latestDiff(): SemanticDiff | undefined {
    return this.state.latestDiff;
  }

  semanticPlan(): SemanticPlan {
    return buildSemanticPlan(this.state.canonical, this.state.planId);
  }

  validate(): ValidationResult {
    return validatePlan(this.state.canonical, this.semanticPlan());
  }

  applyPatch(patch: SemanticPatch): { semantic: SemanticPlan; diff: SemanticDiff; dryRun: boolean; revision: number; validation?: ValidationResult } {
    const result = applyCanonicalPatch(this.state.canonical, patch, this.state.planId);
    let validation: ValidationResult | undefined;

    if (patch.validate) {
      validation = validatePlan(result.document, result.after);
      const blocking = validation.diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal");
      if (blocking) {
        throw new Error(`Patch validation failed; no changes were committed: ${validation.diagnostics.map((diagnostic) => diagnostic.code).join(", ")}`);
      }
    }

    this.state.latestDiff = result.diff;

    if (!result.dryRun) {
      this.state.canonical = result.document;
      this.state.dirty = true;
      this.state.diagnostics = result.document.diagnostics;
      this.revisions.next("semantic patch");
    }

    return {
      semantic: result.after,
      diff: result.diff,
      dryRun: result.dryRun,
      revision: this.revision,
      ...(validation ? { validation } : {})
    };
  }

  markMutated(reason: string): number {
    this.state.dirty = true;
    return this.revisions.next(reason);
  }

  markSaved(): void {
    this.state.dirty = false;
  }

  async save(path = this.state.sourcePath, createBackup = true): Promise<SavePlanResult> {
    const validation = this.validate();
    const blocking = validation.diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal");
    if (blocking) {
      return { path, revision: this.revision, validation };
    }

    const serialized = serializeJmxDocument(this.state.canonical);
    const reparsed = parseHashTreeDocument(loadXml(serialized));
    const parseBlocking = reparsed.diagnostics.some((diagnostic) => diagnostic.severity === "error" || diagnostic.severity === "fatal");
    if (parseBlocking) {
      return {
        path,
        revision: this.revision,
        validation: { valid: false, diagnostics: reparsed.diagnostics }
      };
    }

    let backupPath: string | undefined;
    if (createBackup) {
      try {
        backupPath = await backupFile(path);
      } catch {
        backupPath = undefined;
      }
    }

    await atomicWriteFile(path, serialized);
    this.state.sourcePath = path;
    this.state.dirty = false;
    const revision = this.revisions.next("save");
    const saved: SavePlanResult = { path, revision, validation };
    if (backupPath) {
      saved.backupPath = backupPath;
    }
    return saved;
  }

  summary() {
    return {
      planId: this.state.planId,
      sourcePath: this.state.sourcePath,
      revision: this.revision,
      dirty: this.state.dirty,
      openedAt: this.state.openedAt,
      diagnostics: this.state.diagnostics
    };
  }
}
