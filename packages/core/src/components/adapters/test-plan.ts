import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { coreDescriptors } from "../descriptors/core.js";

export const testPlanAdapter: ComponentAdapter = {
  descriptor: coreDescriptors[0]!,
  toFields: defaultFields
};
