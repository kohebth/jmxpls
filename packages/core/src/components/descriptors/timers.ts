import type { ComponentDescriptor } from "../../model/catalog.js";

const timerTypes = ["ConstantTimer", "UniformRandomTimer", "GaussianRandomTimer", "PoissonRandomTimer", "SyncTimer", "ConstantThroughputTimer", "PreciseThroughputTimer", "JSR223Timer", "BeanShellTimer"];

export const timerDescriptors: ComponentDescriptor[] = timerTypes.map((type) => ({
  type,
  role: "timer",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: [{ name: "delayMs", type: "number" }]
}));
