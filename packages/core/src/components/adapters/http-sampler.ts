import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { httpDescriptors } from "../descriptors/http.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const httpSamplerAdapter: ComponentAdapter = {
  descriptor: httpDescriptors.find((descriptor) => descriptor.type === "HTTPSamplerProxy")!,
  toFields: (element) => ({
    ...defaultFields(element),
    ...httpFields(element)
  })
};

export function httpFields(element: JmxElementNode): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  assignIfPresent(fields, "method", findPropertyValue(element.properties, "HTTPSampler.method"));
  assignIfPresent(fields, "protocol", findPropertyValue(element.properties, "HTTPSampler.protocol"));
  assignIfPresent(fields, "domain", findPropertyValue(element.properties, "HTTPSampler.domain"));
  assignIfPresent(fields, "port", numberOrString(findPropertyValue(element.properties, "HTTPSampler.port")));
  assignIfPresent(fields, "path", findPropertyValue(element.properties, "HTTPSampler.path"));
  assignIfPresent(fields, "implementation", findPropertyValue(element.properties, "HTTPSampler.implementation"));
  assignIfPresent(fields, "followRedirects", booleanOrString(findPropertyValue(element.properties, "HTTPSampler.follow_redirects")));
  assignIfPresent(fields, "autoRedirects", booleanOrString(findPropertyValue(element.properties, "HTTPSampler.auto_redirects")));
  assignIfPresent(fields, "useKeepAlive", booleanOrString(findPropertyValue(element.properties, "HTTPSampler.use_keepalive")));
  assignIfPresent(fields, "connectTimeoutMs", numberOrString(findPropertyValue(element.properties, "HTTPSampler.connect_timeout")));
  assignIfPresent(fields, "responseTimeoutMs", numberOrString(findPropertyValue(element.properties, "HTTPSampler.response_timeout")));
  assignIfPresent(fields, "body", findPropertyValue(element.properties, "HTTPSampler.postBodyRaw"));
  return fields;
}

function findPropertyValue(properties: JmxPropertyNode[], name: string): string | undefined {
  for (const property of properties) {
    if (property.name === name) {
      return property.value;
    }
    const childValue = findPropertyValue(property.children, name);
    if (childValue !== undefined) {
      return childValue;
    }
  }
  return undefined;
}

function numberOrString(value: string | undefined): string | number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function booleanOrString(value: string | undefined): string | boolean | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}

function assignIfPresent(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
