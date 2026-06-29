import type { Diagnostic } from "../model/diagnostics.js";
import type { HashTreeNode, JmxDocument, JmxElementNode, JmxPairNode, JmxRootNode } from "../model/canonical.js";
import type { XmlDocument, XmlElementNode } from "../xml/xml-types.js";
import { fingerprintElement } from "./fingerprint.js";
import { childPath, hashTreePath, rootPath } from "./jmeter-path.js";
import { parsePropertyTree } from "./property-tree.js";

export function parseHashTreeDocument(xml: XmlDocument): JmxDocument {
  const diagnostics: Diagnostic[] = [...xml.diagnostics];

  if (!xml.root) {
    diagnostics.push({
      code: "JMX_UNEXPECTED_ROOT",
      severity: "fatal",
      message: "JMX document has no root element.",
      fixSuggestion: "Provide a jmeterTestPlan root element."
    });
    return { xml, diagnostics };
  }

  if (xml.root.name !== "jmeterTestPlan") {
    diagnostics.push({
      code: "JMX_UNEXPECTED_ROOT",
      severity: "fatal",
      message: `Expected jmeterTestPlan root but found ${xml.root.name}.`,
      fixSuggestion: "Use a valid JMeter .jmx file with a jmeterTestPlan root."
    });
  }

  const rootHashTree = childElements(xml.root).find((child) => child.name === "hashTree");
  const root: JmxRootNode = {
    kind: "jmxRoot",
    element: xml.root
  };

  if (rootHashTree) {
    root.hashTree = parseHashTree(rootHashTree, rootPath(), diagnostics);
  } else {
    diagnostics.push({
      code: "JMX_ELEMENT_WITHOUT_HASHTREE",
      severity: "fatal",
      message: "jmeterTestPlan root does not contain a hashTree child.",
      fixSuggestion: "Add the root hashTree required by JMeter."
    });
  }

  return { xml, root, diagnostics };
}

export function parseHashTree(raw: XmlElementNode, parentPath: string, diagnostics: Diagnostic[]): HashTreeNode {
  const children = childElements(raw);
  const path = hashTreePath(parentPath);
  const pairs: JmxPairNode[] = [];

  if (raw.name !== "hashTree") {
    diagnostics.push({
      code: "JMX_HASH_TREE_ORPHAN",
      severity: "fatal",
      message: `Expected hashTree but found ${raw.name}.`,
      jmxPath: parentPath
    });
  }

  if (children.length % 2 !== 0) {
    diagnostics.push({
      code: "JMX_HASH_TREE_ODD_CHILDREN",
      severity: "fatal",
      message: "hashTree contains an odd number of element children.",
      jmxPath: path,
      fixSuggestion: "Each JMX element must be followed by a hashTree."
    });
  }

  for (let index = 0; index < children.length; index += 2) {
    const elementRaw = children[index];
    const hashTreeRaw = children[index + 1];

    if (!elementRaw) {
      continue;
    }

    const elementPath = childPath(parentPath, elementRaw.name, pairs.length);

    if (elementRaw.name === "hashTree") {
      diagnostics.push({
        code: "JMX_HASH_TREE_ORPHAN",
        severity: "fatal",
        message: "hashTree appeared where a JMX test element was expected.",
        jmxPath: elementPath,
        fixSuggestion: "Remove the orphan hashTree or attach it after its owning element."
      });
      continue;
    }

    const element = parseJmxElement(elementRaw, elementPath);

    if (!hashTreeRaw || hashTreeRaw.name !== "hashTree") {
      diagnostics.push({
        code: "JMX_ELEMENT_WITHOUT_HASHTREE",
        severity: "fatal",
        message: `${elementRaw.name} is not followed by a hashTree.`,
        jmxPath: elementPath,
        fixSuggestion: "Insert an owning hashTree immediately after the element."
      });
      continue;
    }

    pairs.push({
      kind: "pair",
      path: elementPath,
      nodeId: fingerprintElement(elementRaw),
      element,
      children: parseHashTree(hashTreeRaw, elementPath, diagnostics)
    });
  }

  return { kind: "hashTree", path, pairs, raw };
}

export function parseJmxElement(raw: XmlElementNode, path: string): JmxElementNode {
  const element: JmxElementNode = {
    kind: "element",
    path,
    tagName: raw.name,
    properties: parsePropertyTree(raw),
    raw
  };

  if (raw.attributes.testclass) {
    element.testClass = raw.attributes.testclass;
  }
  if (raw.attributes.guiclass) {
    element.guiClass = raw.attributes.guiclass;
  }
  if (raw.attributes.testname) {
    element.testName = raw.attributes.testname;
  }
  if (raw.attributes.enabled !== undefined) {
    element.enabled = raw.attributes.enabled === "true";
  }

  return element;
}

function childElements(element: XmlElementNode): XmlElementNode[] {
  return element.children.filter((child): child is XmlElementNode => child.kind === "element");
}
