import type { SemanticDiff } from "../model/diff.js";
import type { SemanticPatch } from "../model/patches.js";
import type { SemanticPlan } from "../model/semantic.js";
import { diffSemanticPlans } from "../diff/semantic-diff.js";
import { AtomicTransaction } from "./atomic-transaction.js";
import { applySemanticOperation } from "./operations.js";

export type PatchResult = {
  plan: SemanticPlan;
  diff: SemanticDiff;
  dryRun: boolean;
};

export function applySemanticPatch(plan: SemanticPlan, patch: SemanticPatch): PatchResult {
  let working: SemanticPlan = structuredClone(plan);
  const transaction = new AtomicTransaction(plan, working);

  for (const operation of patch.operations) {
    working = applySemanticOperation(working, operation);
  }

  const diff = diffSemanticPlans(plan, working);
  const resultPlan = patch.dryRun ? transaction.rollback() : transaction.commit();

  return {
    plan: patch.dryRun ? resultPlan : working,
    diff,
    dryRun: patch.dryRun ?? false
  };
}
