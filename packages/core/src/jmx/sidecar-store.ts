import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

import type { Diagnostic } from "../model/diagnostics.js";
import type { SidecarDocument, SidecarLoadResult, SidecarNodeIdentity } from "../model/sidecar.js";

export function sidecarPathFor(jmxPath: string): string {
  return `${jmxPath.slice(0, jmxPath.length - extname(jmxPath).length)}.jmxpls.meta.json`;
}

export async function loadSidecar(jmxPath: string): Promise<SidecarLoadResult> {
  const path = sidecarPathFor(jmxPath);
  const diagnostics: Diagnostic[] = [];

  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!isSidecarDocument(parsed)) {
      return {
        diagnostics: [corruptSidecarDiagnostic(path, "Sidecar JSON does not match the expected schema.")]
      };
    }

    return { sidecar: parsed, diagnostics };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { diagnostics };
    }

    return {
      diagnostics: [corruptSidecarDiagnostic(path, error instanceof Error ? error.message : "Unknown sidecar read error")]
    };
  }
}

export async function saveSidecar(jmxPath: string, nodes: SidecarNodeIdentity[]): Promise<SidecarDocument> {
  const sidecar: SidecarDocument = {
    schemaVersion: 1,
    sourcePath: jmxPath,
    updatedAt: new Date().toISOString(),
    nodes
  };

  await writeFile(sidecarPathFor(jmxPath), `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  return sidecar;
}

export function reconcileSidecar(sidecar: SidecarDocument | undefined, currentNodes: SidecarNodeIdentity[]): SidecarNodeIdentity[] {
  if (!sidecar) {
    return currentNodes;
  }

  const byFingerprint = new Map(sidecar.nodes.map((node) => [node.fingerprint, node]));

  return currentNodes.map((node) => {
    const existing = byFingerprint.get(node.fingerprint);
    return existing ? { ...node, nodeId: existing.nodeId } : node;
  });
}

function isSidecarDocument(value: unknown): value is SidecarDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SidecarDocument>;
  return candidate.schemaVersion === 1 && typeof candidate.sourcePath === "string" && Array.isArray(candidate.nodes);
}

function corruptSidecarDiagnostic(path: string, message: string): Diagnostic {
  return {
    code: "JMX_SIDECAR_CORRUPT",
    severity: "warning",
    message: `Ignoring corrupt sidecar ${path}: ${message}`,
    fixSuggestion: "Regenerate the sidecar by saving the plan again."
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
