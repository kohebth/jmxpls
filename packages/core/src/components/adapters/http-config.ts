import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { httpDescriptors } from "../descriptors/http.js";
import { httpFields } from "./http-sampler.js";

export const httpConfigAdapters: ComponentAdapter[] = httpDescriptors
  .filter((descriptor) => descriptor.type !== "HTTPSamplerProxy")
  .map((descriptor) => ({
    descriptor,
    toFields: (element) => ({
      ...defaultFields(element),
      ...(descriptor.type === "ConfigTestElement" ? httpFields(element) : {})
    })
  }));
