import type { SemanticNode, SemanticPlan } from "../model/semantic.js";

export type PlanLanguageMode = "outline" | "flow" | "semantic" | "full";
export type PlanLanguageDetail = "compact" | "expanded" | "lossless-references" | "raw-linked";
export type RedactionMode = "none" | "standard" | "strict";

export type PlanLanguageDocument = {
  format: "jmxpls-plan-language";
  version: 1;
  mode: PlanLanguageMode;
  detail: PlanLanguageDetail;
  name: string;
  nodes: PlanLanguageNode[];
  warnings: string[];
};

export type PlanLanguageNode = {
  nodeId: string;
  role: SemanticNode["role"];
  type: string;
  name: string;
  enabled: boolean;
  children?: PlanLanguageNode[];
  fields?: Record<string, unknown>;
  rawRef?: string;
};

export type PlanLanguageProjectionOptions = {
  mode?: PlanLanguageMode;
  detail?: PlanLanguageDetail;
  redaction?: RedactionMode;
  subtreeNodeId?: string;
};

export type PlanLanguageParseResult = {
  document: PlanLanguageDocument;
  sourceFormat: "json" | "yaml";
};

export type PlanLanguageRoundTripResult = {
  equivalent: boolean;
  original: SemanticPlan;
  projected: PlanLanguageDocument;
  reparsed: PlanLanguageDocument;
};
