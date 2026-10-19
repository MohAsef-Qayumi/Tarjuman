import { json } from "@/server/http"
import { providerNames } from "@/server/service"

export function GET() {
  return json({ ok: providerNames.length > 0, providers: providerNames })
}
