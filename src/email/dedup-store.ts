export class DedupStore {
  private readonly seen = new Set<string>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  /** Returns true when the key was not seen before. */
  tryMark(key: string): boolean {
    if (this.seen.has(key)) {
      return false;
    }

    if (this.seen.size >= this.maxEntries) {
      const first = this.seen.values().next().value;
      if (first !== undefined) {
        this.seen.delete(first);
      }
    }

    this.seen.add(key);
    return true;
  }

  clear(): void {
    this.seen.clear();
  }
}
