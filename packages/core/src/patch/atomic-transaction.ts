export class AtomicTransaction<T> {
  private committed = false;

  constructor(private readonly original: T, private readonly working: T) {
  }

  value(): T {
    return this.working;
  }

  commit(): T {
    this.committed = true;
    return this.working;
  }

  rollback(): T {
    return this.original;
  }

  isCommitted(): boolean {
    return this.committed;
  }
}
