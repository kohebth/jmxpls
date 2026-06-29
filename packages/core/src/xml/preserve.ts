import type { LineEnding } from "./xml-types.js";

export function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const withoutCrLf = text.replace(/\r\n/g, "");
  const lf = (withoutCrLf.match(/\n/g) ?? []).length;
  const cr = (withoutCrLf.match(/\r/g) ?? []).length;
  const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length;

  if (kinds === 0) {
    return "none";
  }

  if (kinds > 1) {
    return "mixed";
  }

  if (crlf > 0) {
    return "crlf";
  }

  return lf > 0 ? "lf" : "cr";
}

export function detectEncoding(input: Uint8Array): string {
  if (input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
    return "utf-8-bom";
  }

  if (input.length >= 2 && input[0] === 0xff && input[1] === 0xfe) {
    return "utf-16le";
  }

  if (input.length >= 2 && input[0] === 0xfe && input[1] === 0xff) {
    return "utf-16be";
  }

  return "utf-8";
}

export function decodeXml(input: Uint8Array): { text: string; encoding: string } {
  const encoding = detectEncoding(input);

  if (encoding === "utf-16be") {
    const swapped = new Uint8Array(input.length - 2);
    for (let i = 2; i < input.length; i += 2) {
      swapped[i - 2] = input[i + 1] ?? 0;
      swapped[i - 1] = input[i] ?? 0;
    }
    return { text: new TextDecoder("utf-16le").decode(swapped), encoding };
  }

  if (encoding === "utf-16le") {
    return { text: new TextDecoder("utf-16le").decode(input), encoding };
  }

  return { text: new TextDecoder("utf-8").decode(input), encoding };
}
