export type XmlDiff = {
  changed: boolean;
  beforeLength: number;
  afterLength: number;
};

export function diffXmlStrings(before: string, after: string): XmlDiff {
  return {
    changed: before !== after,
    beforeLength: before.length,
    afterLength: after.length
  };
}
