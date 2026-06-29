import type { ComponentDescriptor } from "../../model/catalog.js";

const processorTypes = ["JSR223PreProcessor", "JSR223PostProcessor", "JDBCPreProcessor", "UserParameters", "HTMLLinkParser", "URLRewritingModifier", "ResultAction", "DebugPostProcessor", "BeanShellPreProcessor", "BeanShellPostProcessor"];

export const processorDescriptors: ComponentDescriptor[] = processorTypes.map((type) => ({
  type,
  role: "processor",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: []
}));
