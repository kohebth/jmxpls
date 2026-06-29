export type SemanticDiff = {
  revisionBefore: number;
  revisionAfter: number;
  changes: SemanticDiffChange[];
};

export type SemanticDiffChange =
  | NodeAddedChange
  | NodeDeletedChange
  | NodeMovedChange
  | NodeRenamedChange
  | NodeEnabledChange
  | FieldUpdatedChange;

export type BaseChange = {
  nodeId: string;
  jmxPath?: string;
};

export type NodeAddedChange = BaseChange & {
  kind: "node.added";
  parentNodeId?: string;
  nodeType: string;
  name?: string;
};

export type NodeDeletedChange = BaseChange & {
  kind: "node.deleted";
  nodeType: string;
  name?: string;
};

export type NodeMovedChange = BaseChange & {
  kind: "node.moved";
  fromParentNodeId?: string;
  toParentNodeId?: string;
  fromIndex?: number;
  toIndex?: number;
};

export type NodeRenamedChange = BaseChange & {
  kind: "node.renamed";
  before: string;
  after: string;
};

export type NodeEnabledChange = BaseChange & {
  kind: "node.enabledChanged";
  before: boolean;
  after: boolean;
};

export type FieldUpdatedChange = BaseChange & {
  kind: "field.updated";
  fieldPath: string;
  before: unknown;
  after: unknown;
};
