import type { Diagnostic } from "../model/diagnostics.js";
import { loadXml } from "../xml/load-xml.js";

export type RawPropertyPatch = {
  nodeId: string;
  propertyPath: string;
  xmlFragment: string;
};

export function validateRawPatch(patch: RawPropertyPatch): Diagnostic[] {
  const parsed = loadXml(`<raw>${patch.xmlFragment}</raw>`);
  return parsed.diagnostics.map((diagnostic) => ({ ...diagnostic, code: "JMX_RAW_PATCH_INVALID_XML" }));
}
