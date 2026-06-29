import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { extractorDescriptors } from "../descriptors/extractors.js";

export const extractorAdapters: ComponentAdapter[] = extractorDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
