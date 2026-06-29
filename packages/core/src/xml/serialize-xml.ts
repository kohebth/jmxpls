import type { XmlDocument, XmlElementNode, XmlNode } from "./xml-types.js";

export type SerializeXmlOptions = {
  pretty?: boolean;
  indent?: string;
};

export function serializeXmlDocument(document: XmlDocument, options: SerializeXmlOptions = {}): string {
  const lines: string[] = [];

  if (document.declaration) {
    lines.push(serializeDeclaration(document));
  }

  if (document.root) {
    lines.push(serializeXmlNode(document.root, options, 0));
  }

  return lines.join(newlineFor(document.lineEnding));
}

export function serializeXmlNode(node: XmlNode, options: SerializeXmlOptions = {}, depth = 0): string {
  switch (node.kind) {
    case "element":
      return serializeElement(node, options, depth);
    case "text":
      return escapeText(node.text);
    case "comment":
      return `<!--${node.text}-->`;
    case "cdata":
      return `<![CDATA[${node.text}]]>`;
    case "processingInstruction":
      return `<?${node.target}${node.body ? ` ${node.body}` : ""}?>`;
  }
}

export function structurallyEquivalentXml(left: XmlElementNode | undefined, right: XmlElementNode | undefined): boolean {
  if (!left || !right) {
    return left === right;
  }

  if (left.name !== right.name || left.selfClosing !== right.selfClosing) {
    return false;
  }

  if (JSON.stringify(sortAttrs(left.attributes)) !== JSON.stringify(sortAttrs(right.attributes))) {
    return false;
  }

  const leftChildren = left.children.filter((child) => child.kind !== "text" || child.text.trim().length > 0);
  const rightChildren = right.children.filter((child) => child.kind !== "text" || child.text.trim().length > 0);

  if (leftChildren.length !== rightChildren.length) {
    return false;
  }

  return leftChildren.every((child, index) => structurallyEquivalentNode(child, rightChildren[index]));
}

function structurallyEquivalentNode(left: XmlNode, right: XmlNode | undefined): boolean {
  if (!right || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "element" && right.kind === "element") {
    return structurallyEquivalentXml(left, right);
  }

  if (left.kind === "text" && right.kind === "text") {
    return left.text.trim() === right.text.trim();
  }

  if (left.kind === "comment" && right.kind === "comment") {
    return left.text === right.text;
  }

  if (left.kind === "cdata" && right.kind === "cdata") {
    return left.text === right.text;
  }

  if (left.kind === "processingInstruction" && right.kind === "processingInstruction") {
    return left.target === right.target && left.body === right.body;
  }

  return false;
}

function serializeDeclaration(document: XmlDocument): string {
  const declaration = document.declaration;
  if (!declaration) {
    return "";
  }

  const parts = [
    declaration.version ? `version="${escapeAttribute(declaration.version)}"` : undefined,
    declaration.encoding ? `encoding="${escapeAttribute(declaration.encoding)}"` : undefined,
    declaration.standalone ? `standalone="${escapeAttribute(declaration.standalone)}"` : undefined
  ].filter(Boolean);

  return `<?xml ${parts.join(" ")}?>`;
}

function serializeElement(element: XmlElementNode, options: SerializeXmlOptions, depth: number): string {
  const prefix = options.pretty ? (options.indent ?? "  ").repeat(depth) : "";
  const attrs = Object.entries(element.attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join("");

  if (element.selfClosing && element.children.length === 0) {
    return `${prefix}<${element.name}${attrs}/>`;
  }

  if (element.children.length === 0) {
    return `${prefix}<${element.name}${attrs}></${element.name}>`;
  }

  const serializedChildren = element.children.map((child) => serializeXmlNode(child, options, depth + 1)).join("");
  return `${prefix}<${element.name}${attrs}>${serializedChildren}</${element.name}>`;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function sortAttrs(attrs: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(attrs).sort(([left], [right]) => left.localeCompare(right)));
}

function newlineFor(lineEnding: XmlDocument["lineEnding"]): string {
  if (lineEnding === "crlf") {
    return "\r\n";
  }

  if (lineEnding === "cr") {
    return "\r";
  }

  return "\n";
}
