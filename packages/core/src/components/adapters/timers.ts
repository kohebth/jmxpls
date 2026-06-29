import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { timerDescriptors } from "../descriptors/timers.js";

export const timerAdapters: ComponentAdapter[] = timerDescriptors.map((descriptor) => ({ descriptor, toFields: defaultFields }));
