export type ToolPolicy = {
  allowExecution: boolean;
  allowRawPatch: boolean;
};

export const defaultToolPolicy: ToolPolicy = {
  allowExecution: false,
  allowRawPatch: true
};
