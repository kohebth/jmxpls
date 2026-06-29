import type { Diagnostic, SourceRange } from "../model/diagnostics.js";

export type XmlDocument = {
  encoding: string;
  lineEnding: LineEnding;
  declaration?: XmlDeclaration;
  root?: XmlElementNode;
  diagnostics: Diagnostic[];
};

export type XmlDeclaration = {
  version?: string;
  encoding?: string;
  standalone?: string;
};

export type LineEnding = "lf" | "crlf" | "cr" | "mixed" | "none";

export type XmlNode = XmlElementNode | XmlTextNode | XmlCommentNode | XmlCDataNode | XmlProcessingInstructionNode;

export type XmlElementNode = {
  kind: "element";
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  selfClosing: boolean;
  sourceRange?: SourceRange;
};

export type XmlTextNode = {
  kind: "text";
  text: string;
  sourceRange?: SourceRange;
};

export type XmlCommentNode = {
  kind: "comment";
  text: string;
  sourceRange?: SourceRange;
};

export type XmlCDataNode = {
  kind: "cdata";
  text: string;
  sourceRange?: SourceRange;
};

export type XmlProcessingInstructionNode = {
  kind: "processingInstruction";
  target: string;
  body: string;
  sourceRange?: SourceRange;
};
