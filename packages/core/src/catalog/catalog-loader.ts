import type { ComponentCatalog } from "../model/catalog.js";
import { createBuiltInComponentRegistry } from "../components/built-in.js";

export function loadBuiltInCatalog(): ComponentCatalog {
  return {
    version: 1,
    source: "built-in",
    components: createBuiltInComponentRegistry().descriptors()
  };
}
