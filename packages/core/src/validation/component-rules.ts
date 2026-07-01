import type { ComponentRegistry } from "../components/registry.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { SemanticNode, SemanticPlan } from "../model/semantic.js";
import { flattenSemanticNodes } from "../semantic/summarizer.js";

const REQUIRED_FIELDS: Record<string, Array<{ names: string[]; label: string; severity?: Diagnostic["severity"] }>> = {
  HTTPSamplerProxy: [
    { names: ["domain", "HTTPSampler.domain"], label: "HTTP domain", severity: "warning" },
    { names: ["path", "HTTPSampler.path"], label: "HTTP path", severity: "warning" }
  ],
  CSVDataSet: [{ names: ["filename"], label: "CSV filename" }],
  CounterConfig: [{ names: ["variableName", "CounterConfig.name"], label: "counter variable name" }],
  RandomVariableConfig: [{ names: ["variableName"], label: "random variable name" }],
  JDBCDataSource: [{ names: ["dataSource"], label: "JDBC data source name" }],
  JDBCSampler: [
    { names: ["dataSource"], label: "JDBC data source name" },
    { names: ["query"], label: "JDBC query" }
  ],
  JDBCPreProcessor: [
    { names: ["dataSource"], label: "JDBC data source name" },
    { names: ["query"], label: "JDBC query" }
  ],
  RegexExtractor: [
    { names: ["variableName", "RegexExtractor.refname"], label: "variable name" },
    { names: ["regex", "RegexExtractor.regex"], label: "regular expression" }
  ],
  JSONPostProcessor: [
    { names: ["variableName", "JSONPostProcessor.referenceNames"], label: "variable name" },
    { names: ["jsonPath", "JSONPostProcessor.jsonPathExprs"], label: "JSONPath expression" }
  ],
  BoundaryExtractor: [
    { names: ["variableName", "BoundaryExtractor.refname"], label: "variable name" },
    { names: ["leftBoundary", "BoundaryExtractor.lboundary"], label: "left boundary" },
    { names: ["rightBoundary", "BoundaryExtractor.rboundary"], label: "right boundary" }
  ],
  XPathExtractor: [
    { names: ["variableName", "XPathExtractor.refname"], label: "variable name" },
    { names: ["xpath", "XPathExtractor.xpathQuery"], label: "XPath query" }
  ],
  XPath2Extractor: [
    { names: ["variableName", "XPathExtractor.refname"], label: "variable name" },
    { names: ["xpath", "XPathExtractor.xpathQuery"], label: "XPath query" }
  ],
  HtmlExtractor: [
    { names: ["variableName", "HtmlExtractor.refname"], label: "variable name" },
    { names: ["selector", "HtmlExtractor.expr"], label: "CSS selector" }
  ],
  ResponseAssertion: [{ names: ["patterns", "Assertion.test_strings"], label: "assertion pattern" }],
  JSONPathAssertion: [{ names: ["jsonPath", "JSON_PATH"], label: "JSONPath expression" }],
  XPathAssertion: [{ names: ["xpath", "XPath.xpath"], label: "XPath expression" }],
  XPath2Assertion: [{ names: ["xpath", "XPath.xpath"], label: "XPath expression" }],
  DurationAssertion: [{ names: ["durationMs", "DurationAssertion.duration"], label: "duration limit" }],
  SizeAssertion: [{ names: ["sizeBytes", "SizeAssertion.size"], label: "size limit" }],
  SyncTimer: [{ names: ["groupSize"], label: "synchronizing group size" }],
  ConstantThroughputTimer: [{ names: ["targetThroughput", "throughput"], label: "target throughput" }],
  PreciseThroughputTimer: [{ names: ["targetThroughput", "throughput"], label: "target throughput" }]
};

export function validateComponentRules(plan: SemanticPlan, registry: ComponentRegistry): Diagnostic[] {
  return flattenSemanticNodes(plan.root).flatMap((node) => [
    ...unknownComponentDiagnostic(node, registry),
    ...requiredFieldDiagnostics(node)
  ]);
}

function unknownComponentDiagnostic(node: SemanticNode, registry: ComponentRegistry): Diagnostic[] {
  return registry.lookup({ type: node.type }) ? [] : [{
    code: "JMX_UNKNOWN_COMPONENT",
    severity: "info",
    message: `No typed descriptor found for ${node.type}; raw preservation will be used.`,
    nodeId: node.nodeId,
    jmxPath: node.path,
    fixSuggestion: "Load the plugin jar/classpath and refresh the component catalog, import a matching catalog entry, or use explicit raw tools for this node."
  }];
}

function requiredFieldDiagnostics(node: SemanticNode): Diagnostic[] {
  if (!node.enabled) {
    return [];
  }
  return (REQUIRED_FIELDS[node.type] ?? [])
    .filter((field) => !field.names.some((name) => hasValue(node.fields[name])))
    .map((field) => ({
      code: "JMX_COMPONENT_REQUIRED_FIELD_MISSING",
      severity: field.severity ?? "error",
      message: `${node.type} is missing ${field.label}.`,
      nodeId: node.nodeId,
      jmxPath: node.path,
      fixSuggestion: `Set ${field.label} before validating or running the plan.`
    }));
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}
