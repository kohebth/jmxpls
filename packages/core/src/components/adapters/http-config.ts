import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { httpDescriptors } from "../descriptors/http.js";

export const httpConfigAdapters: ComponentAdapter[] = httpDescriptors
  .filter((descriptor) => descriptor.type !== "HTTPSamplerProxy")
  .map((descriptor) => ({ descriptor, toFields: defaultFields }));
