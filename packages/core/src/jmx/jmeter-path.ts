export function childPath(parentPath: string, segment: string, index: number): string {
  const safeSegment = segment.replaceAll("/", "~1");
  return `${parentPath}/${safeSegment}[${index}]`;
}

export function rootPath(): string {
  return "/jmeterTestPlan";
}

export function hashTreePath(parentPath: string): string {
  return `${parentPath}/hashTree`;
}
