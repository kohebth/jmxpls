export type RevisionEntry = {
  revision: number;
  reason: string;
  createdAt: string;
};

export class RevisionLog {
  private entries: RevisionEntry[] = [{ revision: 0, reason: "opened", createdAt: new Date().toISOString() }];

  current(): number {
    return this.entries.at(-1)?.revision ?? 0;
  }

  next(reason: string): number {
    const revision = this.current() + 1;
    this.entries.push({ revision, reason, createdAt: new Date().toISOString() });
    return revision;
  }

  list(): RevisionEntry[] {
    return [...this.entries];
  }
}
