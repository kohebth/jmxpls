import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { processorDescriptors } from "../descriptors/processors.js";

export const processorAdapters: ComponentAdapter[] = processorDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
