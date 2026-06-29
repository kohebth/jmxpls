import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { samplerDescriptors } from "../descriptors/samplers.js";

export const samplerAdapters: ComponentAdapter[] = samplerDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
