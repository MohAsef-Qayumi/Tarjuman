/**
 * Fixed-window counter per client. In-memory, so each server instance counts
 * separately; enough to stop one client from draining a free-tier quota.
 */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>()

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns seconds until the client may retry, or 0 if the request is allowed. */
  check(client: string): number {
    const t = this.now()
    const current = this.windows.get(client)
    if (!current || t - current.start >= this.windowMs) {
      this.windows.set(client, { start: t, count: 1 })
      this.prune(t)
      return 0
    }
    if (current.count >= this.limit) return Math.ceil((current.start + this.windowMs - t) / 1000)
    current.count++
    return 0
  }

  private prune(t: number) {
    if (this.windows.size < 10_000) return
    for (const [key, w] of this.windows) if (t - w.start >= this.windowMs) this.windows.delete(key)
  }
}
