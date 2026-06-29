import { ComponentRegistry } from "./registry.js";
import { assertionAdapters } from "./adapters/assertions.js";
import { controllerAdapters } from "./adapters/controllers.js";
import { dataConfigAdapters } from "./adapters/data-config.js";
import { extractorAdapters } from "./adapters/extractors.js";
import { httpConfigAdapters } from "./adapters/http-config.js";
import { httpSamplerAdapter } from "./adapters/http-sampler.js";
import { listenerAdapters } from "./adapters/listeners.js";
import { processorAdapters } from "./adapters/processors.js";
import { samplerAdapters } from "./adapters/samplers.js";
import { testPlanAdapter } from "./adapters/test-plan.js";
import { threadGroupAdapters } from "./adapters/thread-group.js";
import { timerAdapters } from "./adapters/timers.js";
import { unknownAdapter } from "./adapters/unknown.js";

export function createBuiltInComponentRegistry(): ComponentRegistry {
  const registry = new ComponentRegistry();

  for (const adapter of [
    testPlanAdapter,
    ...threadGroupAdapters,
    ...controllerAdapters,
    httpSamplerAdapter,
    ...httpConfigAdapters,
    ...dataConfigAdapters,
    ...samplerAdapters,
    ...timerAdapters,
    ...assertionAdapters,
    ...extractorAdapters,
    ...processorAdapters,
    ...listenerAdapters,
    unknownAdapter
  ]) {
    registry.register(adapter);
  }

  return registry;
}
