import type { Diagnostic } from "./diagnostics.js";

export type SidecarDocument = {
  schemaVersion: 1;
  sourcePath: string;
  updatedAt: string;
  nodes: SidecarNodeIdentity[];
};

export type SidecarNodeIdentity = {
  nodeId: string;
  jmxPath: string;
  fingerprint: string;
  testName?: string;
};

export type SidecarLoadResult = {
  sidecar?: SidecarDocument;
  diagnostics: Diagnostic[];
};
