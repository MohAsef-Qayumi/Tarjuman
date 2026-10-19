import type { ChatMessage } from "./prompts"

export type ProviderConfig = {
  /** Provider family, e.g. "gemini". */
  name: string
  /** Unique, log-safe identifier (never contains the key), e.g. "gemini:model-a#2". */
  id: string
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

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * Builds the provider chain from environment variables, in the order given by
 * TRANSLATE_PROVIDERS (default: gemini,groq,openrouter). Key and model
 * variables accept comma-separated lists; every model is tried with every key,
 * preferred models first. Providers without a key or model are skipped.
 */
export function providersFromEnv(env: Record<string, string | undefined>): ProviderConfig[] {
  return list(env.TRANSLATE_PROVIDERS ?? "gemini,groq,openrouter").flatMap((name) => {
    const preset = providerPresets[name]
    if (!preset) return []
    const keys = list(env[preset.keyEnv])
    return list(env[preset.modelEnv]).flatMap((model) =>
      keys.map((apiKey, i) => ({
        name,
        id: `${name}:${model}${keys.length > 1 ? `#${i + 1}` : ""}`,
        baseUrl: preset.baseUrl,
        apiKey,
        model,
      })),
    )
  })
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | null,
    message: string,
    /** From the provider's Retry-After header, when it sent one. */
    readonly retryAfterMs?: number,
  ) {
    super(`${provider}: ${message}`)
  }
}

function retryAfter(res: Response): number | undefined {
  const value = res.headers.get("retry-after")
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

export type Fetch = typeof fetch

export async function complete(
  provider: ProviderConfig,
  messages: ChatMessage[],
  fetchImpl: Fetch = fetch,
  timeoutMs = 15_000,
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
    throw new ProviderError(provider.id, null, (error as Error).message)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new ProviderError(provider.id, res.status, `HTTP ${res.status} ${detail.slice(0, 200)}`, retryAfter(res))
  }

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new ProviderError(provider.id, res.status, "Empty response")
  return content
}

/** Pulls the JSON object out of a model reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("No JSON object in model output")
  return JSON.parse(text.slice(start, end + 1))
}
