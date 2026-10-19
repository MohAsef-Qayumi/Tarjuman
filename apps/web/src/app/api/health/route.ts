import { json } from "@/server/http"
import { translator } from "@/server/service"

export const dynamic = "force-dynamic"

/** Which providers are configured and which are cooling down after failures. Never includes keys. */
export function GET() {
  const providers = translator.status()
  return json({ ok: providers.some((p) => p.coolingDownSeconds === 0), providers })
}
