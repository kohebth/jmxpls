import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { httpDescriptors } from "../descriptors/http.js";

export const httpSamplerAdapter: ComponentAdapter = {
  descriptor: httpDescriptors.find((descriptor) => descriptor.type === "HTTPSamplerProxy")!,
  toFields: defaultFields
};
