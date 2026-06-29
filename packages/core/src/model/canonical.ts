import type { Diagnostic } from "./diagnostics.js";
import type { XmlDocument, XmlElementNode } from "../xml/xml-types.js";

export type JmxDocument = {
  xml: XmlDocument;
  root?: JmxRootNode;
  diagnostics: Diagnostic[];
};

export type JmxRootNode = {
  kind: "jmxRoot";
  element: XmlElementNode;
  hashTree?: HashTreeNode;
};

export type HashTreeNode = {
  kind: "hashTree";
  path: string;
  pairs: JmxPairNode[];
  raw: XmlElementNode;
};

export type JmxPairNode = {
  kind: "pair";
  path: string;
  nodeId: string;
  element: JmxElementNode;
  children: HashTreeNode;
};

export type JmxElementNode = {
  kind: "element";
  path: string;
  tagName: string;
  testClass?: string;
  guiClass?: string;
  testName?: string;
  enabled?: boolean;
  properties: JmxPropertyNode[];
  raw: XmlElementNode;
};

export type JmxPropertyNode = {
  name?: string;
  tagName: string;
  value?: string;
  children: JmxPropertyNode[];
  raw: XmlElementNode;
};
