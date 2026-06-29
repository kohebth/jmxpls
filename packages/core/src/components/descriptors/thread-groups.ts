import type { ComponentDescriptor } from "../../model/catalog.js";

export const threadGroupDescriptors: ComponentDescriptor[] = [
  {
    type: "ThreadGroup",
    role: "threadGroup",
    displayName: "Thread Group",
    xmlTags: ["ThreadGroup"],
    testClasses: ["ThreadGroup"],
    guiClasses: ["ThreadGroupGui"],
    fields: [
      { name: "threads", type: "number" },
      { name: "rampUp", type: "number" },
      { name: "loops", type: "number" }
    ]
  },
  {
    type: "SetupThreadGroup",
    role: "threadGroup",
    displayName: "setUp Thread Group",
    xmlTags: ["SetupThreadGroup"],
    testClasses: ["SetupThreadGroup"],
    guiClasses: [],
    fields: []
  },
  {
    type: "PostThreadGroup",
    role: "threadGroup",
    displayName: "tearDown Thread Group",
    xmlTags: ["PostThreadGroup"],
    testClasses: ["PostThreadGroup"],
    guiClasses: [],
    fields: []
  }
];
