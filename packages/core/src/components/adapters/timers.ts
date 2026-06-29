import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { timerDescriptors } from "../descriptors/timers.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const timerAdapters: ComponentAdapter[] = timerDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...timerFields(element)
  })
}));

function timerFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "ConstantTimer":
      return compactFields({ delayMs: numberOrString(findPropertyValue(element.properties, "ConstantTimer.delay")) });
    case "UniformRandomTimer":
    case "GaussianRandomTimer":
    case "PoissonRandomTimer":
      return compactFields({
        delayMs: numberOrString(findPropertyValue(element.properties, "ConstantTimer.delay")),
        rangeMs: numberOrString(findPropertyValue(element.properties, "RandomTimer.range")),
        deviationMs: numberOrString(findPropertyValue(element.properties, "RandomTimer.deviation")),
        lambdaMs: numberOrString(findPropertyValue(element.properties, "RandomTimer.lambda"))
      });
    case "SyncTimer":
      return compactFields({
        groupSize: numberOrString(findPropertyValue(element.properties, "groupSize")),
        timeoutMs: numberOrString(findPropertyValue(element.properties, "timeoutInMs"))
      });
    case "ConstantThroughputTimer":
      return compactFields({
        targetThroughput: numberOrString(findPropertyValue(element.properties, "throughput")),
        calcMode: numberOrString(findPropertyValue(element.properties, "calcMode"))
      });
    case "PreciseThroughputTimer":
      return compactFields({
        targetThroughput: numberOrString(findPropertyValue(element.properties, "throughput")),
        throughputPeriod: numberOrString(findPropertyValue(element.properties, "throughputPeriod")),
        durationSeconds: numberOrString(findPropertyValue(element.properties, "duration")),
        batchSize: numberOrString(findPropertyValue(element.properties, "batchSize")),
        batchThreadDelay: numberOrString(findPropertyValue(element.properties, "batchThreadDelay"))
      });
    case "JSR223Timer":
      return compactFields({
        language: findPropertyValue(element.properties, "scriptLanguage"),
        script: findPropertyValue(element.properties, "script"),
        filename: findPropertyValue(element.properties, "filename"),
        parameters: findPropertyValue(element.properties, "parameters"),
        cacheKey: findPropertyValue(element.properties, "cacheKey")
      });
    default:
      return {};
  }
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

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function numberOrString(value: string | undefined): string | number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}
