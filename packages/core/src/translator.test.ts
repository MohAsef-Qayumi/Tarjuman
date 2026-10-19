import { describe, expect, it, vi } from "vitest"
import { MemoryCache } from "./cache"
import { ProviderHealth } from "./health"
import { translateMessages } from "./prompts"
import { extractJson, providersFromEnv, type ProviderConfig } from "./providers"
import { NoProviderError, Translator } from "./translator"

const gemini: ProviderConfig = { name: "gemini", id: "gemini", baseUrl: "https://g.test", apiKey: "k1", model: "m1" }
const groq: ProviderConfig = { name: "groq", id: "groq", baseUrl: "https://q.test", apiKey: "k2", model: "m2" }

const reply = (content: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status })

const good = JSON.stringify({ translation: "This hadith is authentic.", detectedLanguage: "ar", terms: [] })

describe("Translator", () => {
  it("translates and caches the result", async () => {
    const fetch = vi.fn(async () => reply(good))
    const t = new Translator([gemini], new MemoryCache(), fetch)
    const req = { text: "هذا حديث صحيح", from: "ar", to: "en" } as const

    const first = await t.translate(req)
    const second = await t.translate(req)

    expect(first).toMatchObject({ translation: "This hadith is authentic.", cached: false, provider: "gemini" })
    expect(second.cached).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("falls back to the next provider when one is rate limited", async () => {
    const fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).startsWith("https://g.test") ? new Response("quota", { status: 429 }) : reply(good),
    )
    const result = await new Translator([gemini, groq], new MemoryCache(), fetch).translate({ text: "نص", from: "ar", to: "en" })
    expect(result.provider).toBe("groq")
  })

  it("falls back when a provider returns malformed output", async () => {
    let call = 0
    const fetch = vi.fn(async () => (call++ === 0 ? reply("Sorry, I cannot help with that.") : reply(good)))
    const result = await new Translator([gemini, groq], new MemoryCache(), fetch).translate({ text: "نص", from: "ar", to: "en" })
    expect(result.provider).toBe("groq")
  })

  it("reports every failure when all providers fail", async () => {
    const fetch = vi.fn(async () => new Response("down", { status: 503 }))
    await expect(new Translator([gemini, groq], new MemoryCache(), fetch).translate({ text: "نص", from: "ar", to: "en" })).rejects.toThrow(
      /gemini: HTTP 503.*groq: HTTP 503/,
    )
  })

  it("explains when no provider is configured", async () => {
    await expect(new Translator([]).translate({ text: "نص", from: "ar", to: "en" })).rejects.toBeInstanceOf(NoProviderError)
  })

  it("skips the model when source and target are the same", async () => {
    const fetch = vi.fn()
    const result = await new Translator([gemini], new MemoryCache(), fetch).translate({ text: "hello", from: "en", to: "en" })
    expect(result.translation).toBe("hello")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("looks up a single word", async () => {
    const info = { word: "صحيح", root: "ص ح ح", meanings: ["authentic", "sound"], inContext: "authentic" }
    const fetch = vi.fn(async () => reply(JSON.stringify(info)))
    const result = await new Translator([gemini], new MemoryCache(), fetch).lookupWord({ word: "صحيح", context: "حديث صحيح", to: "en" })
    expect(result).toMatchObject({ root: "ص ح ح", provider: "gemini" })
  })
})

describe("failover", () => {
  const openrouter: ProviderConfig = { name: "openrouter", id: "openrouter", baseUrl: "https://o.test", apiKey: "k3", model: "m3" }
  const hostOf = (url: string | URL | Request) => new URL(String(url)).host

  it("puts a failing provider on cooldown so later requests skip it", async () => {
    let t = 0
    const calls: string[] = []
    const fetch = vi.fn(async (url: string | URL | Request) => {
      calls.push(hostOf(url))
      return hostOf(url) === "g.test" ? new Response("overloaded", { status: 503 }) : reply(good)
    })
    const translator = new Translator([gemini, groq], new MemoryCache(), fetch, new ProviderHealth(() => t))

    await translator.translate({ text: "أ", from: "ar", to: "en" })
    await translator.translate({ text: "ب", from: "ar", to: "en" })
    expect(calls).toEqual(["g.test", "q.test", "q.test"])

    t = 31_000 // cooldown over: gemini gets another chance
    await translator.translate({ text: "ت", from: "ar", to: "en" })
    expect(calls.at(-2)).toBe("g.test")
  })

  it("honours the provider's Retry-After header", async () => {
    let t = 0
    const fetch = vi.fn(async (url: string | URL | Request) =>
      hostOf(url) === "g.test" ? new Response("slow down", { status: 429, headers: { "Retry-After": "120" } }) : reply(good),
    )
    const translator = new Translator([gemini, groq], new MemoryCache(), fetch, new ProviderHealth(() => t))
    await translator.translate({ text: "أ", from: "ar", to: "en" })
    expect(translator.status()).toEqual([
      { id: "gemini", coolingDownSeconds: 120 },
      { id: "groq", coolingDownSeconds: 0 },
    ])
  })

  it("chains through every provider until one works", async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => {
      if (hostOf(url) === "g.test") return new Response("down", { status: 503 })
      if (hostOf(url) === "q.test") return new Response("bad key", { status: 401 })
      return reply(good)
    })
    const result = await new Translator([gemini, groq, openrouter], new MemoryCache(), fetch).translate({ text: "أ", from: "ar", to: "en" })
    expect(result.provider).toBe("openrouter")
  })

  it("still tries cooling-down providers when nothing else is left", async () => {
    let t = 0
    let fail = true
    const fetch = vi.fn(async () => (fail ? new Response("down", { status: 503 }) : reply(good)))
    const translator = new Translator([gemini], new MemoryCache(), fetch, new ProviderHealth(() => t))
    await expect(translator.translate({ text: "أ", from: "ar", to: "en" })).rejects.toThrow()
    fail = false
    t = 1000
    await expect(translator.translate({ text: "ب", from: "ar", to: "en" })).resolves.toMatchObject({ provider: "gemini" })
  })
})

describe("prompts", () => {
  it("includes only glossary terms found in the passage", () => {
    const [, user] = translateMessages("أجمع العلماء، وهذا هو الراجح", "ar", "en")
    expect(user!.content).toContain("al-rājiḥ")
    expect(user!.content).not.toContain("tayammum")
  })

  it("names the target language", () => {
    const [, user] = translateMessages("نص", "auto", "ps")
    expect(user!.content).toContain("Pashto")
    expect(user!.content).toContain("Detect the source language")
  })
})

describe("providers", () => {
  it("extracts JSON from fenced or chatty output", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Here you go: {"a":{"b":2}} hope it helps')).toEqual({ a: { b: 2 } })
    expect(() => extractJson("no json")).toThrow()
  })

  it("builds the provider chain from env in the configured order", () => {
    const env = {
      TRANSLATE_PROVIDERS: "groq,gemini",
      GEMINI_API_KEY: "a",
      GEMINI_MODEL: "gm",
      GROQ_API_KEY: "b",
      GROQ_MODEL: "qm",
      OPENROUTER_API_KEY: "c",
    }
    expect(providersFromEnv(env).map((p) => p.name)).toEqual(["groq", "gemini"])
    expect(providersFromEnv({ GEMINI_API_KEY: "a" })).toEqual([])
  })

  it("expands comma-separated keys and models, preferred model first, without leaking keys", () => {
    const chain = providersFromEnv({ TRANSLATE_PROVIDERS: "gemini", GEMINI_API_KEY: "key-1, key-2", GEMINI_MODEL: "best,backup" })
    expect(chain.map((p) => p.id)).toEqual(["gemini:best#1", "gemini:best#2", "gemini:backup#1", "gemini:backup#2"])
    expect(chain.map((p) => p.apiKey)).toEqual(["key-1", "key-2", "key-1", "key-2"])
    expect(chain.some((p) => p.id.includes("key"))).toBe(false)
  })
})
