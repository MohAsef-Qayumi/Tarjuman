import { isLanguage, type LanguageCode, type SourceLanguage } from "@tarjuman/core/languages"

export type Settings = {
  apiBase: string
  from: SourceLanguage
  to: LanguageCode
  /** Show the button on every site, not only on Arabic pages. */
  everywhere: boolean
  buttonPosition: { right: number; bottom: number } | null
}

declare const __DEFAULT_API__: string

export const defaults: Settings = {
  apiBase: __DEFAULT_API__,
  from: "auto",
  to: "en",
  everywhere: false,
  buttonPosition: null,
}

export async function loadSettings(): Promise<Settings> {
  const stored = (await chrome.storage.sync.get(defaults)) as Settings
  return { ...stored, to: isLanguage(stored.to) ? stored.to : defaults.to }
}

export function saveSettings(patch: Partial<Settings>) {
  return chrome.storage.sync.set(patch)
}
