/** A run's pending timers, cleared together when it ends. None keeps the server alive. */
export class RunTimers {
  private readonly pending = new Set<NodeJS.Timeout>();

  after(ms: number, run: () => void): void {
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      run();
    }, ms);
    timer.unref();
    this.pending.add(timer);
  }

  clearAll(): void {
    for (const timer of this.pending) clearTimeout(timer);
    this.pending.clear();
  }
}
