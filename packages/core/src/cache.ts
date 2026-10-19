export interface Cache {
  get(key: string): Promise<unknown | undefined>
  set(key: string, value: unknown): Promise<void>
}

/** Bounded in-memory LRU. Map preserves insertion order, so the first key is the oldest. */
export class MemoryCache implements Cache {
  private entries = new Map<string, unknown>()

  constructor(private readonly maxEntries = 500) {}

  async get(key: string) {
    if (!this.entries.has(key)) return undefined
    const value = this.entries.get(key)
    this.entries.delete(key)
    this.entries.set(key, value)
    return value
  }

  async set(key: string, value: unknown) {
    this.entries.delete(key)
    this.entries.set(key, value)
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
  }
}

/** SHA-256 hex digest, available in browsers, workers and Node 18+. */
export async function hashKey(...parts: (string | number)[]): Promise<string> {
  const bytes = new TextEncoder().encode(parts.join("\u0000"))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}
