import { NoProviderError } from "@tarjuman/core"
import type { z } from "zod"
import { rateLimiter } from "./service"

// The API holds no user data or cookies, so any origin (including the browser extension) may call it.
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...cors, ...headers } })

export const preflight = () => new Response(null, { status: 204, headers: cors })

function clientId(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local"
}

/** Shared pipeline for POST endpoints: rate limit → validate → run → map errors. */
export async function handle<S extends z.ZodType>(req: Request, schema: S, run: (input: z.infer<S>) => Promise<unknown>) {
  const retryAfter = rateLimiter.check(clientId(req))
  if (retryAfter > 0) {
    return json({ error: "Too many requests. Please wait a moment." }, 429, { "Retry-After": String(retryAfter) })
  }

  const parsed = schema.safeParse(await req.json().catch(() => undefined))
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return json({ error: issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request" }, 400)
  }

  try {
    return json(await run(parsed.data))
  } catch (error) {
    if (error instanceof NoProviderError) {
      console.error(error.message)
      return json({ error: "Translation is temporarily unavailable. Please try again shortly." }, 503)
    }
    throw error
  }
}
