import { hashKey } from "@tarjuman/core/cache"
import type { Reply, Request } from "./messages"
import { loadSettings } from "./settings"

const MAX_CACHED = 400
const INDEX_KEY = "cache-index"

/**
 * Translations are cached on the device, so re-opening a page costs nothing
 * and keeps working without a connection.
 */
async function cached<T>(key: string, produce: () => Promise<T>): Promise<T> {
  const hit = (await chrome.storage.local.get(key))[key] as T | undefined
  if (hit) return hit

  const value = await produce()
  const index = ((await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] as string[] | undefined) ?? []
  const next = [...index.filter((k) => k !== key), key]
  const evicted = next.splice(0, Math.max(0, next.length - MAX_CACHED))
  await chrome.storage.local.set({ [key]: value, [INDEX_KEY]: next })
  if (evicted.length) await chrome.storage.local.remove(evicted)
  return value
}

async function callApi<T>(path: string, body: unknown): Promise<T> {
  const { apiBase } = await loadSettings()
  let res: Response
  try {
    res = await fetch(new URL(path, apiBase), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Can't reach the Tarjuman server. Check your connection.")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

async function handle(request: Request): Promise<unknown> {
  switch (request.type) {
    case "translate": {
      const { text, from, to } = request
      return cached(await hashKey("t", from, to, text), () => callApi("/api/translate", { text, from, to }))
    }
    case "word": {
      const { word, context, to } = request
      return cached(await hashKey("w", to, word, context), () => callApi("/api/word", { word, context, to }))
    }
  }
}

chrome.runtime.onMessage.addListener((request: Request, _sender, respond: (reply: Reply<unknown>) => void) => {
  handle(request).then(
    (data) => respond({ ok: true, data }),
    (error: Error) => respond({ ok: false, error: error.message }),
  )
  return true // keep the channel open for the async reply
})
