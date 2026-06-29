import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { dataConfigDescriptors } from "../descriptors/data-config.js";

export const dataConfigAdapters: ComponentAdapter[] = dataConfigDescriptors.map((descriptor) => ({
  descriptor,
  toFields: defaultFields
}));
