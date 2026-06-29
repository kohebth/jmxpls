export type SemanticPatch = {
  operations: SemanticPatchOperation[];
  dryRun?: boolean;
  validate?: boolean;
};

export type SemanticPatchOperation =
  | AddNodeOperation
  | UpdateFieldOperation
  | DeleteNodeOperation
  | MoveNodeOperation
  | CloneNodeOperation
  | SetEnabledOperation;

export type PatchOperationBase = {
  opId?: string;
  nodeId?: string;
};

export type AddNodeOperation = PatchOperationBase & {
  op: "addNode";
  parentNodeId: string;
  index?: number;
  nodeType: string;
  fields?: Record<string, unknown>;
};

export type UpdateFieldOperation = PatchOperationBase & {
  op: "updateField";
  nodeId: string;
  fieldPath: string;
  value: unknown;
};

export type DeleteNodeOperation = PatchOperationBase & {
  op: "deleteNode";
  nodeId: string;
};

export type MoveNodeOperation = PatchOperationBase & {
  op: "moveNode";
  nodeId: string;
  toParentNodeId: string;
  index?: number;
};

export type CloneNodeOperation = PatchOperationBase & {
  op: "cloneNode";
  nodeId: string;
  toParentNodeId: string;
  index?: number;
};

export type SetEnabledOperation = PatchOperationBase & {
  op: "setEnabled";
  nodeId: string;
  enabled: boolean;
};
