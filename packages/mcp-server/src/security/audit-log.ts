export type AuditEntry = {
  at: string;
  action: string;
  target?: string;
};

export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  record(action: string, target?: string): void {
    const entry: AuditEntry = { at: new Date().toISOString(), action };
    if (target) {
      entry.target = target;
    }
    this.entries.push(entry);
  }

  list(): AuditEntry[] {
    return [...this.entries];
  }
}
