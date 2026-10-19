import type { ChatMessage } from "./prompts"

export type ProviderConfig = {
  name: string
  baseUrl: string
  apiKey: string
  model: string
}

/** OpenAI-compatible endpoints of providers with a free tier. */
export const providerPresets: Record<string, { baseUrl: string; keyEnv: string; modelEnv: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
  },
  groq: { baseUrl: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL" },
}

/**
 * Builds the provider chain from environment variables, in the order given by
 * TRANSLATE_PROVIDERS (default: gemini,groq,openrouter). Providers without a
 * key or model are skipped.
 */
export function providersFromEnv(env: Record<string, string | undefined>): ProviderConfig[] {
  const order = (env.TRANSLATE_PROVIDERS ?? "gemini,groq,openrouter").split(",").map((s) => s.trim())
  return order.flatMap((name) => {
    const preset = providerPresets[name]
    const apiKey = preset && env[preset.keyEnv]
    const model = preset && env[preset.modelEnv]
    return preset && apiKey && model ? [{ name, baseUrl: preset.baseUrl, apiKey, model }] : []
  })
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | null,
    message: string,
  ) {
    super(`${provider}: ${message}`)
  }
}

export type Fetch = typeof fetch

export async function complete(
  provider: ProviderConfig,
  messages: ChatMessage[],
  fetchImpl: Fetch = fetch,
  timeoutMs = 30_000,
): Promise<string> {
  let res: Response
  try {
    res = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new ProviderError(provider.name, null, (error as Error).message)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new ProviderError(provider.name, res.status, `HTTP ${res.status} ${detail.slice(0, 200)}`)
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new ProviderError(provider.name, res.status, "Empty response")
  return content
}

/** Pulls the JSON object out of a model reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("No JSON object in model output")
  return JSON.parse(text.slice(start, end + 1))
}
