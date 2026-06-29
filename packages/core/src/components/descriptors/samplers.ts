import type { ComponentDescriptor } from "../../model/catalog.js";

const samplerTypes = ["FTPSampler", "JDBCSampler", "JavaSampler", "JUnitSampler", "LDAPSampler", "LDAPExtSampler", "JMSSampler", "MailReaderSampler", "SmtpSampler", "TCPSampler", "SystemSampler", "DebugSampler", "JSR223Sampler", "BeanShellSampler"];

export const samplerDescriptors: ComponentDescriptor[] = samplerTypes.map((type) => ({
  type,
  role: "sampler",
  displayName: type,
  xmlTags: [type],
  testClasses: [type],
  guiClasses: [],
  fields: type === "BeanShellSampler" ? [{ name: "legacyWarning", type: "string" }] : []
}));
