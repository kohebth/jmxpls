import type { ComponentDescriptor } from "../../model/catalog.js";

const controllers = ["LoopController", "OnceOnlyController", "InterleaveControl", "RandomController", "RandomOrderController", "RecordingController", "RunTime", "IfController", "WhileController", "SwitchController", "ForeachController", "ModuleController", "IncludeController", "TransactionController", "ThroughputController", "CriticalSectionController"];

export const controllerDescriptors: ComponentDescriptor[] = controllers.map((type) => ({
  type,
  role: "controller",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: []
}));
