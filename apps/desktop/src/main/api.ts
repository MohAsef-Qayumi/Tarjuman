import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { hashKey } from "@tarjuman/core/cache"
import type { LanguageCode, SourceLanguage } from "@tarjuman/core/languages"
import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import type { Result } from "@tarjuman/panel"

const MAX_ENTRIES = 500

/**
 * Talks to the Tarjuman server and keeps an on-disk cache, so passages that
 * were already translated open instantly and keep working offline.
 */
export class Api {
  private cache = new Map<string, unknown>()
  private readonly file: string
  private saveTimer: NodeJS.Timeout | undefined

  constructor(
    dir: string,
    private readonly base: () => string,
  ) {
    this.file = join(dir, "cache.json")
    try {
      this.cache = new Map(JSON.parse(readFileSync(this.file, "utf8")) as [string, unknown][])
    } catch {
      // No cache yet.
    }
  }

  async translate(text: string, from: SourceLanguage, to: LanguageCode): Promise<Result<TranslateResult>> {
    return this.cached(await hashKey("t", from, to, text), () => this.post("/api/translate", { text, from, to }))
  }

  async lookup(word: string, context: string, to: LanguageCode): Promise<Result<WordResult>> {
    return this.cached(await hashKey("w", to, word, context), () => this.post("/api/word", { word, context, to }))
  }

  private async cached<T>(key: string, produce: () => Promise<T>): Promise<Result<T>> {
    if (this.cache.has(key)) {
      const value = this.cache.get(key) as T
      this.cache.delete(key)
      this.cache.set(key, value) // refresh recency
      return { ok: true, data: value }
    }
    try {
      const value = await produce()
      this.cache.set(key, value)
      while (this.cache.size > MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value!)
      this.scheduleSave()
      return { ok: true, data: value }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(new URL(path, this.base()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      })
    } catch {
      throw new Error("Can't reach the Tarjuman server. Check your internet connection.")
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
    return data as T
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 1000)
  }

  flush() {
    clearTimeout(this.saveTimer)
    try {
      writeFileSync(this.file, JSON.stringify([...this.cache]))
    } catch (error) {
      console.error("Could not save cache", error)
    }
  }
}
