import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { listenerDescriptors } from "../descriptors/listeners.js";

export const listenerAdapters: ComponentAdapter[] = listenerDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
