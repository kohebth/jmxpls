import type { ComponentDescriptor } from "../../model/catalog.js";

export const httpDescriptors: ComponentDescriptor[] = [
  { type: "HTTPSamplerProxy", role: "sampler", displayName: "HTTP Request", xmlTags: ["HTTPSamplerProxy"], testClasses: ["HTTPSamplerProxy"], guiClasses: ["HttpTestSampleGui"], fields: [{ name: "method", type: "string" }, { name: "domain", type: "string" }, { name: "path", type: "string" }, { name: "body", type: "string" }] },
  { type: "HeaderManager", role: "config", displayName: "HTTP Header Manager", xmlTags: ["HeaderManager"], testClasses: ["HeaderManager"], guiClasses: ["HeaderPanel"], fields: [{ name: "headers", type: "array" }] },
  { type: "CookieManager", role: "config", displayName: "HTTP Cookie Manager", xmlTags: ["CookieManager"], testClasses: ["CookieManager"], guiClasses: ["CookiePanel"], fields: [] },
  { type: "CacheManager", role: "config", displayName: "HTTP Cache Manager", xmlTags: ["CacheManager"], testClasses: ["CacheManager"], guiClasses: ["CacheManagerGui"], fields: [] },
  { type: "AuthManager", role: "config", displayName: "HTTP Authorization Manager", xmlTags: ["AuthManager"], testClasses: ["AuthManager"], guiClasses: ["AuthPanel"], fields: [] },
  { type: "DNSCacheManager", role: "config", displayName: "DNS Cache Manager", xmlTags: ["DNSCacheManager"], testClasses: ["DNSCacheManager"], guiClasses: ["DNSCachePanel"], fields: [] }
];
