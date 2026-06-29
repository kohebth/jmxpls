import { resolve } from "node:path";

export class WorkspaceGuard {
  constructor(private readonly roots: string[]) {
  }

  allows(path: string): boolean {
    const target = resolve(path);
    return this.roots.some((root) => {
      const resolvedRoot = resolve(root);
      return target === resolvedRoot || target.startsWith(`${resolvedRoot}/`);
    });
  }
}
