export type SemanticPlan = {
  planId?: string;
  name: string;
  root: SemanticNode[];
  indexes: SemanticIndexes;
  warnings: string[];
};

export type SemanticNode = {
  nodeId: string;
  parentNodeId?: string;
  path: string;
  role: SemanticRole;
  type: string;
  name: string;
  enabled: boolean;
  fields: Record<string, unknown>;
  children: SemanticNode[];
  rawRef: string;
};

export type SemanticRole =
  | "testPlan"
  | "threadGroup"
  | "controller"
  | "sampler"
  | "config"
  | "timer"
  | "assertion"
  | "extractor"
  | "processor"
  | "listener"
  | "unknown";

export type SemanticIndexes = {
  byId: Record<string, string>;
  byRole: Record<string, string[]>;
  byName: Record<string, string[]>;
  byType: Record<string, string[]>;
  variables: Record<string, string[]>;
};

export type ThreadGroupSummary = {
  nodeId: string;
  name: string;
  enabled: boolean;
  threads?: unknown;
  rampUpSec?: unknown;
  loops?: unknown;
  durationSec?: unknown;
};

export type PlanSummary = {
  name: string;
  nodeCount: number;
  threadGroups: ThreadGroupSummary[];
  samplers: Array<{ nodeId: string; name: string; type: string; enabled: boolean }>;
  warnings: string[];
};
