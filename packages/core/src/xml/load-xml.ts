import { readFile } from "node:fs/promises";

import { SaxesParser } from "saxes";

import type { Diagnostic } from "../model/diagnostics.js";
import { currentPosition, sourceRange } from "./source-map.js";
import { decodeXml, detectLineEnding } from "./preserve.js";
import type { XmlDeclaration, XmlDocument, XmlElementNode, XmlNode } from "./xml-types.js";

export async function loadXmlFile(path: string): Promise<XmlDocument> {
  const bytes = await readFile(path);
  return loadXml(bytes);
}

export function loadXml(input: Uint8Array | string): XmlDocument {
  const decoded = typeof input === "string" ? { text: input, encoding: "utf-8" } : decodeXml(input);
  const diagnostics: Diagnostic[] = [];
  const document: XmlDocument = {
    encoding: decoded.encoding,
    lineEnding: detectLineEnding(decoded.text),
    diagnostics
  };
  const stack: XmlElementNode[] = [];
  const roots: XmlElementNode[] = [];

  const parser = new SaxesParser({ xmlns: false, fragment: false });

  parser.on("xmldecl", (decl) => {
    const declaration: XmlDeclaration = {};
    if (decl.version) {
      declaration.version = decl.version;
    }
    if (decl.encoding) {
      declaration.encoding = decl.encoding;
    }
    if (decl.standalone !== undefined) {
      declaration.standalone = String(decl.standalone);
    }
    document.declaration = declaration;
  });

  parser.on("opentag", (tag) => {
    const element: XmlElementNode = {
      kind: "element",
      name: tag.name,
      attributes: normalizeAttributes(tag.attributes),
      children: [],
      selfClosing: tag.isSelfClosing,
      sourceRange: sourceRange(currentPosition(parser.line, parser.column), currentPosition(parser.line, parser.column))
    };

    appendNode(stack, roots, element);

    if (!tag.isSelfClosing) {
      stack.push(element);
    }
  });

  parser.on("closetag", (tag) => {
    const name = typeof tag === "string" ? tag : tag.name;
    const element = stack.at(-1);

    if (!element || element.name !== name) {
      return;
    }

    stack.pop();
    if (element.sourceRange) {
      element.sourceRange.endLine = Math.max(1, parser.line);
      element.sourceRange.endColumn = Math.max(1, parser.column);
    }
  });

  parser.on("text", (text) => {
    appendNode(stack, roots, { kind: "text", text });
  });

  parser.on("cdata", (text) => {
    appendNode(stack, roots, { kind: "cdata", text });
  });

  parser.on("comment", (text) => {
    appendNode(stack, roots, { kind: "comment", text });
  });

  parser.on("processinginstruction", (instruction) => {
    appendNode(stack, roots, {
      kind: "processingInstruction",
      target: instruction.target,
      body: instruction.body
    });
  });

  parser.on("error", (error) => {
    diagnostics.push({
      code: "JMX_XML_PARSE_ERROR",
      severity: "fatal",
      message: error.message,
      sourceRange: sourceRange(currentPosition(parser.line, parser.column), currentPosition(parser.line, parser.column)),
      fixSuggestion: "Fix the XML syntax before loading this JMX file."
    });
  });

  try {
    parser.write(decoded.text).close();
  } catch (error) {
    diagnostics.push({
      code: "JMX_XML_PARSE_ERROR",
      severity: "fatal",
      message: error instanceof Error ? error.message : "Unknown XML parse error",
      fixSuggestion: "Fix the XML syntax before loading this JMX file."
    });
  }

  const root = roots.find((node): node is XmlElementNode => node.kind === "element");
  if (root) {
    document.root = root;
  }

  if (roots.filter((node) => node.kind === "element").length > 1) {
    diagnostics.push({
      code: "JMX_XML_MULTIPLE_ROOTS",
      severity: "fatal",
      message: "XML document contains multiple root elements."
    });
  }

  return document;
}

function appendNode(stack: XmlElementNode[], roots: XmlNode[], node: XmlNode): void {
  const parent = stack.at(-1);

  if (parent) {
    parent.children.push(node);
    return;
  }

  roots.push(node);
}

function normalizeAttributes(attributes: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name, String(value)]));
}
