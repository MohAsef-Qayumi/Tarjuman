import type { ProviderConfig } from "./providers"
import { ProviderError } from "./providers"

const SECOND = 1000
const MINUTE = 60 * SECOND
const MAX_COOLDOWN = 10 * MINUTE

/**
 * How long to stop sending traffic to a provider after a failure. Without
 * this, every request would first wait for an overloaded provider to fail
 * before falling back.
 */
export function cooldownFor(error: unknown): number {
  if (!(error instanceof ProviderError)) return 0
  const { status, retryAfterMs } = error
  if (retryAfterMs !== undefined) return Math.min(Math.max(retryAfterMs, SECOND), MAX_COOLDOWN)
  if (status === 429) return MINUTE // rate limited
  if (status === 401 || status === 403) return MAX_COOLDOWN // bad or revoked key
  if (status === 400 || status === 404) return MAX_COOLDOWN // unknown model or unsupported request
  if (status === null || status >= 500) return 30 * SECOND // overloaded, down or timed out
  return 0
}

export class ProviderHealth {
  private until = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  fail(id: string, cooldownMs: number) {
    if (cooldownMs > 0) this.until.set(id, this.now() + cooldownMs)
  }

  succeed(id: string) {
    this.until.delete(id)
  }

  /**
   * Healthy providers first, in configured order. Cooling-down providers go
   * last, soonest-available first, so a request is still attempted when
   * every provider has recently failed.
   */
  order(providers: ProviderConfig[]): ProviderConfig[] {
    const t = this.now()
    const wait = (p: ProviderConfig) => Math.max(0, (this.until.get(p.id) ?? 0) - t)
    const healthy = providers.filter((p) => wait(p) === 0)
    const cooling = providers.filter((p) => wait(p) > 0).sort((a, b) => wait(a) - wait(b))
    return [...healthy, ...cooling]
  }

  status(providers: ProviderConfig[]) {
    const t = this.now()
    return providers.map((p) => ({
      id: p.id,
      coolingDownSeconds: Math.ceil(Math.max(0, (this.until.get(p.id) ?? 0) - t) / SECOND),
    }))
  }
}
