import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { threadGroupDescriptors } from "../descriptors/thread-groups.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const threadGroupAdapters: ComponentAdapter[] = threadGroupDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...threadGroupFields(element)
  })
}));

function threadGroupFields(element: JmxElementNode): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  assignIfPresent(fields, "threads", numberOrString(findPropertyValue(element.properties, "ThreadGroup.num_threads")));
  assignIfPresent(fields, "rampUpSec", numberOrString(findPropertyValue(element.properties, "ThreadGroup.ramp_time")));
  assignIfPresent(fields, "sameUserOnNextIteration", booleanOrString(findPropertyValue(element.properties, "ThreadGroup.same_user_on_next_iteration")));
  assignIfPresent(fields, "scheduler", booleanOrString(findPropertyValue(element.properties, "ThreadGroup.scheduler")));
  assignIfPresent(fields, "durationSec", numberOrString(findPropertyValue(element.properties, "ThreadGroup.duration")));
  assignIfPresent(fields, "startupDelaySec", numberOrString(findPropertyValue(element.properties, "ThreadGroup.delay")));
  assignIfPresent(fields, "onSampleError", findPropertyValue(element.properties, "ThreadGroup.on_sample_error"));

  const forever = booleanOrString(findPropertyValue(element.properties, "LoopController.continue_forever"));
  if (forever === true) {
    fields.loops = "forever";
  } else {
    assignIfPresent(fields, "loops", numberOrString(findPropertyValue(element.properties, "LoopController.loops")));
  }

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
