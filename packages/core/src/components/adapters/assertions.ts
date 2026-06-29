import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { assertionDescriptors } from "../descriptors/assertions.js";

export const assertionAdapters: ComponentAdapter[] = assertionDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
