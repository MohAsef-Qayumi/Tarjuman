import type { LanguageCode, SourceLanguage } from "@tarjuman/core/languages"
import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import type { Result } from "@tarjuman/panel"

export type Request =
  | { type: "translate"; text: string; from: SourceLanguage; to: LanguageCode }
  | { type: "word"; word: string; context: string; to: LanguageCode }

export type Reply<T> = Result<T>

export type TranslateReply = Reply<TranslateResult>
export type WordReply = Reply<WordResult>

/** Content scripts can't call the API directly (page CSP/CORS), so the background worker does. */
export function send<T>(request: Request): Promise<Reply<T>> {
  return chrome.runtime.sendMessage(request)
}
