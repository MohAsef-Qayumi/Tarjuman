import { wordRequestSchema } from "@tarjuman/core"
import { handle, preflight } from "@/server/http"
import { translator } from "@/server/service"

export const OPTIONS = preflight

export function POST(req: Request) {
  return handle(req, wordRequestSchema, (input) => translator.lookupWord(input))
}
