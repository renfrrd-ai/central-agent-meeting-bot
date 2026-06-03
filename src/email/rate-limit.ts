const HOUR_MS = 60 * 60 * 1000;

interface WindowState {
  windowStart: number;
  count: number;
}

export class SenderRateLimiter {
  private readonly windows = new Map<string, WindowState>();
  private readonly limitPerHour: number;

  constructor(limitPerHour: number) {
    this.limitPerHour = limitPerHour;
  }

  canProceed(sender: string): boolean {
    if (this.limitPerHour === 0) {
      return true;
    }

    const key = sender.toLowerCase();
    const now = Date.now();
    const state = this.windows.get(key);

    if (!state || now - state.windowStart >= HOUR_MS) {
      return true;
    }

    return state.count < this.limitPerHour;
  }

  record(sender: string): void {
    if (this.limitPerHour === 0) {
      return;
    }

    const key = sender.toLowerCase();
    const now = Date.now();
    const state = this.windows.get(key);

    if (!state || now - state.windowStart >= HOUR_MS) {
      this.windows.set(key, { windowStart: now, count: 1 });
      return;
    }

    state.count += 1;
  }

  clear(): void {
    this.windows.clear();
  }
}
