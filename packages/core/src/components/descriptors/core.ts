import type { ComponentDescriptor } from "../../model/catalog.js";

export const coreDescriptors: ComponentDescriptor[] = [
  {
    type: "TestPlan",
    role: "testPlan",
    displayName: "Test Plan",
    xmlTags: ["TestPlan"],
    testClasses: ["TestPlan"],
    guiClasses: ["TestPlanGui"],
    fields: [{ name: "comments", type: "string" }]
  }
];
