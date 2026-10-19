import { hashKey, MemoryCache, type Cache } from "./cache"
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
  ) {}

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
   * Tries providers in order. A provider that is rate limited, down, or returns
   * output that doesn't match the schema is skipped in favour of the next one,
   * so free tiers can be stacked.
   */
  private async run<S extends z.ZodType>(
    key: string,
    messages: ChatMessage[],
    schema: S,
  ): Promise<z.infer<S> & { cached: boolean; provider: string }> {
    const hit = (await this.cache.get(key)) as (z.infer<S> & { provider: string }) | undefined
    if (hit) return { ...hit, cached: true }

    const failures: string[] = []
    for (const provider of this.providers) {
      try {
        const raw = await complete(provider, messages, this.fetchImpl)
        const parsed = schema.safeParse(extractJson(raw))
        if (!parsed.success) {
          failures.push(`${provider.name}: response did not match the expected format`)
          continue
        }
        const result = { ...(parsed.data as object), provider: provider.name } as z.infer<S> & { provider: string }
        await this.cache.set(key, result)
        return { ...result, cached: false }
      } catch (error) {
        failures.push(error instanceof ProviderError ? error.message : `${provider.name}: ${(error as Error).message}`)
      }
    }
    throw new NoProviderError(failures)
  }
}
