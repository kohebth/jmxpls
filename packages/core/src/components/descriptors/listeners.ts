import type { ComponentDescriptor } from "../../model/catalog.js";

const listenerTypes = ["ResultCollector", "SimpleDataWriter", "SummaryReport", "AggregateReport", "AggregateGraph", "ViewResultsTree", "ViewResultsFullVisualizer", "TableVisualizer", "BackendListener", "GraphVisualizer", "MailerVisualizer"];

export const listenerDescriptors: ComponentDescriptor[] = listenerTypes.map((type) => ({
  type,
  role: "listener",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: [{ name: "saveConfig", type: "object" }]
}));
