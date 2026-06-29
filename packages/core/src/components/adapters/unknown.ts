import { defaultFields, type ComponentAdapter } from "../adapter.js";

export const unknownAdapter: ComponentAdapter = {
  descriptor: {
    type: "unknown",
    role: "unknown",
    displayName: "Unknown JMeter Component",
    xmlTags: [],
    testClasses: [],
    guiClasses: [],
    fields: []
  },
  toFields: defaultFields,
  applyFields: (node, fields) => ({ ...node, fields: { ...node.fields, ...fields } })
};
