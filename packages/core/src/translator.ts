import { hashKey, MemoryCache, type Cache } from "./cache"
import { cooldownFor, ProviderHealth } from "./health"
import { PROMPT_VERSION, translateMessages, wordMessages, type ChatMessage } from "./prompts"
import { complete, extractJson, ProviderError, type Fetch, type ProviderConfig } from "./providers"
import {
  translationSchema,
  wordInfoSchema,
  type TranslateRequest,
  type TranslateResult,
  type WordRequest,
  type WordResult,
} from "./schema"
import type { z } from "zod"

export class NoProviderError extends Error {
  constructor(readonly failures: string[]) {
    super(failures.length ? `All translation providers failed: ${failures.join("; ")}` : "No translation provider configured")
  }
}

export class Translator {
  constructor(
    private readonly providers: ProviderConfig[],
    private readonly cache: Cache = new MemoryCache(),
    private readonly fetchImpl: Fetch = fetch,
    private readonly health = new ProviderHealth(),
  ) {}

  /** Provider ids and cooldowns, safe to expose (no keys). */
  status() {
    return this.health.status(this.providers)
  }

  async translate({ text, from, to }: TranslateRequest): Promise<TranslateResult> {
    if (from === to) return { translation: text, detectedLanguage: to, terms: [], cached: false, provider: "none" }
    const key = await hashKey("translate", PROMPT_VERSION, from, to, text)
    return this.run(key, translateMessages(text, from, to), translationSchema)
  }

  async lookupWord({ word, context, to }: WordRequest): Promise<WordResult> {
    const key = await hashKey("word", PROMPT_VERSION, to, word, context)
    return this.run(key, wordMessages(word, context, to), wordInfoSchema)
  }

  /**
   * Tries providers in order of health. A provider that is rate limited, down,
   * or returns output that doesn't match the schema is skipped in favour of the
   * next one, so free tiers can be stacked; failing providers are also put on a
   * cooldown so later requests go straight to one that works.
   */
  private async run<S extends z.ZodType>(
    key: string,
    messages: ChatMessage[],
    schema: S,
  ): Promise<z.infer<S> & { cached: boolean; provider: string }> {
    const hit = (await this.cache.get(key)) as (z.infer<S> & { provider: string }) | undefined
    if (hit) return { ...hit, cached: true }

    const failures: string[] = []
    for (const provider of this.health.order(this.providers)) {
      try {
        const raw = await complete(provider, messages, this.fetchImpl)
        const parsed = schema.safeParse(extractJson(raw))
        if (!parsed.success) {
          // Malformed output is usually specific to this input, so no cooldown.
          failures.push(`${provider.id}: response did not match the expected format`)
          continue
        }
        this.health.succeed(provider.id)
        const result = { ...(parsed.data as object), provider: provider.name } as z.infer<S> & { provider: string }
        await this.cache.set(key, result)
        return { ...result, cached: false }
      } catch (error) {
        this.health.fail(provider.id, cooldownFor(error))
        failures.push(error instanceof ProviderError ? error.message : `${provider.id}: ${(error as Error).message}`)
      }
    }
    throw new NoProviderError(failures)
  }
}
