import { resolve } from "node:path";

export function isPathInsideWorkspace(path: string, workspaceRoot: string): boolean {
  const root = resolve(workspaceRoot);
  const target = resolve(path);
  return target === root || target.startsWith(`${root}/`);
}
