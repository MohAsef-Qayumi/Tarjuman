import { MemoryCache, providersFromEnv, Translator, type Fetch } from "@tarjuman/core"
import { RateLimiter } from "./rate-limit"

/**
 * Canned replies so the app and extension can be developed and tested
 * without an API key. Enabled with TARJUMAN_MOCK=1.
 */
const mockFetch: Fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
  const prompt = body.messages.at(-1)?.content ?? ""
  const passage = /<passage>\n([\s\S]*)\n<\/passage>/.exec(prompt)?.[1]
  const content = passage
    ? { translation: `[mock translation] ${passage.slice(0, 120)}`, detectedLanguage: "ar", terms: [] }
    : { word: /Word: (.*)/.exec(prompt)?.[1] ?? "", root: "ك ت ب", meanings: ["[mock] to write"], inContext: "[mock]" }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }))
}

const mock = process.env.TARJUMAN_MOCK === "1"
const providers = mock
  ? [{ name: "mock", id: "mock", baseUrl: "https://mock.invalid", apiKey: "mock", model: "mock" }]
  : providersFromEnv(process.env)

export const translator = new Translator(providers, new MemoryCache(1000), mock ? mockFetch : fetch)
export const rateLimiter = new RateLimiter(Number(process.env.RATE_LIMIT_PER_MINUTE) || 20)
