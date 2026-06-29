import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { controllerDescriptors } from "../descriptors/controllers.js";

export const controllerAdapters: ComponentAdapter[] = controllerDescriptors.map((descriptor) => ({
  descriptor,
  toFields: defaultFields
}));
