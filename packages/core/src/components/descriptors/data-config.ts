import type { ComponentDescriptor } from "../../model/catalog.js";

export const dataConfigDescriptors: ComponentDescriptor[] = [
  { type: "Arguments", role: "config", displayName: "User Defined Variables", xmlTags: ["Arguments"], testClasses: ["Arguments"], guiClasses: ["ArgumentsPanel"], fields: [{ name: "variables", type: "object" }] },
  { type: "CSVDataSet", role: "config", displayName: "CSV Data Set Config", xmlTags: ["CSVDataSet"], testClasses: ["CSVDataSet"], guiClasses: ["TestBeanGUI"], fields: [{ name: "filename", type: "string" }, { name: "variableNames", type: "array" }] },
  { type: "CounterConfig", role: "config", displayName: "Counter", xmlTags: ["CounterConfig"], testClasses: ["CounterConfig"], guiClasses: ["CounterConfigGui"], fields: [] },
  { type: "RandomVariableConfig", role: "config", displayName: "Random Variable", xmlTags: ["RandomVariableConfig"], testClasses: ["RandomVariableConfig"], guiClasses: ["TestBeanGUI"], fields: [] },
  { type: "JDBCDataSource", role: "config", displayName: "JDBC Connection Configuration", xmlTags: ["JDBCDataSource"], testClasses: ["JDBCDataSource"], guiClasses: ["TestBeanGUI"], fields: [{ name: "dataSource", type: "string" }] }
];
