export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private readonly limit = 50) {}
  push(value: T): void {
    this.past.push(structuredClone(value));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T): T | undefined {
    const previous = this.past.pop();
    if (previous !== undefined) this.future.push(structuredClone(current));
    return previous;
  }
  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next !== undefined) this.past.push(structuredClone(current));
    return next;
  }
  clear(): void {
    this.past = [];
    this.future = [];
  }
}
