import { defaultFields, type ComponentAdapter } from "../adapter.js";
import { samplerDescriptors } from "../descriptors/samplers.js";
import type { JmxElementNode, JmxPropertyNode } from "../../model/canonical.js";

export const samplerAdapters: ComponentAdapter[] = samplerDescriptors.map((descriptor) => ({
  descriptor,
  toFields: (element) => ({
    ...defaultFields(element),
    ...samplerFields(element)
  })
}));

function samplerFields(element: JmxElementNode): Record<string, unknown> {
  switch (element.testClass ?? element.tagName) {
    case "JDBCSampler":
      return compactFields({
        dataSource: findPropertyValue(element.properties, "dataSource"),
        query: findPropertyValue(element.properties, "query"),
        queryType: findPropertyValue(element.properties, "queryType"),
        parameters: findPropertyValue(element.properties, "queryArguments"),
        variableNames: splitCsv(findPropertyValue(element.properties, "variableNames")),
        resultVariable: findPropertyValue(element.properties, "resultVariable")
      });
    case "FTPSampler":
      return compactFields({
        server: findPropertyValue(element.properties, "FTPSampler.server"),
        remoteFile: findPropertyValue(element.properties, "FTPSampler.remoteFile"),
        localFile: findPropertyValue(element.properties, "FTPSampler.localFile"),
        action: findPropertyValue(element.properties, "FTPSampler.action"),
        binaryMode: booleanOrString(findPropertyValue(element.properties, "FTPSampler.binaryMode"))
      });
    case "TCPSampler":
      return compactFields({
        server: findPropertyValue(element.properties, "TCPSampler.server"),
        port: numberOrString(findPropertyValue(element.properties, "TCPSampler.port")),
        text: findPropertyValue(element.properties, "TCPSampler.text"),
        classname: findPropertyValue(element.properties, "TCPSampler.classname"),
        timeout: numberOrString(findPropertyValue(element.properties, "TCPSampler.timeout"))
      });
    case "JMSSampler":
      return compactFields({
        destination: findPropertyValue(element.properties, "JMSSampler.destination"),
        message: findPropertyValue(element.properties, "JMSSampler.message"),
        providerUrl: findPropertyValue(element.properties, "JMSSampler.providerUrl")
      });
    case "SmtpSampler":
      return compactFields({
        server: findPropertyValue(element.properties, "SMTPSampler.server"),
        recipient: findPropertyValue(element.properties, "SMTPSampler.receiver"),
        sender: findPropertyValue(element.properties, "SMTPSampler.sender"),
        subject: findPropertyValue(element.properties, "SMTPSampler.subject"),
        body: findPropertyValue(element.properties, "SMTPSampler.message")
      });
    case "JSR223Sampler":
      return compactFields({
        language: findPropertyValue(element.properties, "scriptLanguage"),
        script: findPropertyValue(element.properties, "script"),
        filename: findPropertyValue(element.properties, "filename"),
        parameters: findPropertyValue(element.properties, "parameters")
      });
    case "DebugSampler":
      return compactFields({
        displayJMeterVariables: booleanOrString(findPropertyValue(element.properties, "displayJMeterVariables")),
        displayJMeterProperties: booleanOrString(findPropertyValue(element.properties, "displayJMeterProperties")),
        displaySystemProperties: booleanOrString(findPropertyValue(element.properties, "displaySystemProperties"))
      });
    default:
      return {};
  }
}

function findPropertyValue(properties: JmxPropertyNode[], name: string): string | undefined {
  for (const property of properties) {
    if (property.name === name) {
      return property.value;
    }
    const childValue = findPropertyValue(property.children, name);
    if (childValue !== undefined) {
      return childValue;
    }
  }
  return undefined;
}

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function splitCsv(value: string | undefined): string[] | undefined {
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined;
}

function numberOrString(value: string | undefined): string | number | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function booleanOrString(value: string | undefined): string | boolean | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}
