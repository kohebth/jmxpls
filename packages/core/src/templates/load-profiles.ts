import type { AddNodeOperation } from "../model/patches.js";
import type { PlanTemplate, TemplateParameter } from "./registry.js";
import type { TemplateInput } from "./registry.js";
import { numberInput, scalarInput, stringInput } from "./input.js";

type TimerSpec = { nodeType: string; guiClass: string; name: string; fields: Record<string, unknown> };
type LoadProfileSpec = { name: string; title: string; description: string; id: string; users: number; rampSec: number; durationSec: number; timer: TimerSpec };

const profiles: LoadProfileSpec[] = [
  { name: "constant_load_profile", title: "Constant Load", description: "Steady HTTP load with a fixed pacing timer.", id: "template-constant-load-thread-group", users: 20, rampSec: 60, durationSec: 600, timer: { nodeType: "ConstantTimer", guiClass: "ConstantTimerGui", name: "Fixed pacing", fields: { "ConstantTimer.delay": 500 } } },
  { name: "ramp_load_profile", title: "Ramp Load", description: "Gradual HTTP ramp with a precise throughput target.", id: "template-ramp-load-thread-group", users: 50, rampSec: 300, durationSec: 900, timer: { nodeType: "PreciseThroughputTimer", guiClass: "TestBeanGUI", name: "Ramp throughput target", fields: { throughput: 300, throughputPeriod: 60, duration: 900 } } },
  { name: "spike_load_profile", title: "Spike Load", description: "Short HTTP spike coordinated with a synchronizing timer.", id: "template-spike-load-thread-group", users: 100, rampSec: 30, durationSec: 300, timer: { nodeType: "SyncTimer", guiClass: "SyncTimerGui", name: "Spike synchronizer", fields: { groupSize: 50, timeoutInMs: 0 } } },
  { name: "stress_load_profile", title: "Stress Load", description: "High HTTP stress load with a throughput cap.", id: "template-stress-load-thread-group", users: 200, rampSec: 120, durationSec: 600, timer: { nodeType: "ConstantThroughputTimer", guiClass: "TestBeanGUI", name: "Stress throughput cap", fields: { throughput: 1200, calcMode: 1 } } },
  { name: "soak_load_profile", title: "Soak Load", description: "Long-running HTTP soak load with moderate throughput.", id: "template-soak-load-thread-group", users: 25, rampSec: 300, durationSec: 14400, timer: { nodeType: "ConstantThroughputTimer", guiClass: "TestBeanGUI", name: "Soak throughput cap", fields: { throughput: 150, calcMode: 1 } } }
];

const loadProfileParameters: TemplateParameter[] = [
  { name: "idPrefix", type: "string", description: "Node ID prefix for generated elements." },
  { name: "domain", type: "string", description: "Default HTTP host.", defaultValue: "example.com" },
  { name: "protocol", type: "string", description: "Default HTTP protocol.", defaultValue: "https" },
  { name: "port", type: "stringOrNumber", description: "Optional default HTTP port." },
  { name: "path", type: "string", description: "Sample request path.", defaultValue: "/health" },
  { name: "method", type: "string", description: "Sample request method.", defaultValue: "GET" },
  { name: "threads", type: "number", description: "Thread group user count." },
  { name: "rampSec", type: "number", description: "Thread group ramp-up in seconds." },
  { name: "durationSec", type: "number", description: "Scheduled load duration in seconds." },
  { name: "threadGroupName", type: "string", description: "Generated thread group name." },
  { name: "requestName", type: "string", description: "Generated sample request name." },
  { name: "timerName", type: "string", description: "Generated timer name." },
  { name: "delayMs", type: "number", description: "Constant timer delay in milliseconds." },
  { name: "targetThroughput", type: "number", description: "Throughput timer target." },
  { name: "throughputPeriod", type: "number", description: "Precise throughput timer period in seconds." },
  { name: "groupSize", type: "number", description: "Synchronizing timer group size." },
  { name: "timeoutMs", type: "number", description: "Synchronizing timer timeout in milliseconds." },
  { name: "calcMode", type: "number", description: "Constant throughput timer calculation mode." }
];

export const loadProfileTemplates: PlanTemplate[] = profiles.map((profile) => ({
  name: profile.name,
  description: profile.description,
  parameters: loadProfileParameters,
  instantiate: (input = {}) => ({ dryRun: true, operations: loadProfileOperations(profile, input) })
}));

function loadProfileOperations(profile: LoadProfileSpec, input: TemplateInput): AddNodeOperation[] {
  const parentNodeId = `${stringInput(input, "idPrefix", profile.id.replace(/-thread-group$/, ""))}-thread-group`;
  const durationSec = numberInput(input, "durationSec", profile.durationSec);
  const method = stringInput(input, "method", "GET");
  const path = stringInput(input, "path", "/health");
  const port = scalarInput(input, "port");
  return [
    { op: "addNode", parentNodeId: "root", nodeId: parentNodeId, nodeType: "ThreadGroup", fields: { name: stringInput(input, "threadGroupName", profile.title), guiClass: "ThreadGroupGui", "ThreadGroup.num_threads": numberInput(input, "threads", profile.users), "ThreadGroup.ramp_time": numberInput(input, "rampSec", numberInput(input, "rampUpSec", profile.rampSec)), "ThreadGroup.scheduler": true, "ThreadGroup.duration": durationSec, "LoopController.continue_forever": true, "LoopController.loops": -1 } },
    { op: "addNode", parentNodeId, nodeType: "ConfigTestElement", fields: { name: "HTTP Request Defaults", guiClass: "HttpDefaultsGui", "HTTPSampler.protocol": stringInput(input, "protocol", "https"), "HTTPSampler.domain": stringInput(input, "domain", "example.com"), ...(port !== undefined ? { "HTTPSampler.port": port } : {}) } },
    { op: "addNode", parentNodeId, nodeType: "HTTPSamplerProxy", fields: { name: stringInput(input, "requestName", `${method} ${path}`), guiClass: "HttpTestSampleGui", "HTTPSampler.method": method, "HTTPSampler.path": path } },
    { op: "addNode", parentNodeId, nodeType: profile.timer.nodeType, fields: { name: stringInput(input, "timerName", profile.timer.name), guiClass: profile.timer.guiClass, ...timerFields(profile.timer.fields, input, durationSec) } },
    { op: "addNode", parentNodeId, nodeType: "ResultCollector", fields: { name: "Summary Report", guiClass: "SummaryReport" } }
  ];
}

function timerFields(defaults: Record<string, unknown>, input: TemplateInput, durationSec: number): Record<string, unknown> {
  const fields = { ...defaults };
  if ("ConstantTimer.delay" in fields) fields["ConstantTimer.delay"] = numberInput(input, "delayMs", Number(fields["ConstantTimer.delay"]));
  if ("throughput" in fields) fields.throughput = numberInput(input, "targetThroughput", Number(fields.throughput));
  if ("throughputPeriod" in fields) fields.throughputPeriod = numberInput(input, "throughputPeriod", Number(fields.throughputPeriod));
  if ("duration" in fields) fields.duration = durationSec;
  if ("groupSize" in fields) fields.groupSize = numberInput(input, "groupSize", Number(fields.groupSize));
  if ("timeoutInMs" in fields) fields.timeoutInMs = numberInput(input, "timeoutMs", Number(fields.timeoutInMs));
  if ("calcMode" in fields) fields.calcMode = numberInput(input, "calcMode", Number(fields.calcMode));
  return fields;
}
