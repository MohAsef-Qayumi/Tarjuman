import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { isLanguage, type LanguageCode, type SourceLanguage } from "@tarjuman/core/languages"

export type Settings = {
  apiBase: string
  from: SourceLanguage
  to: LanguageCode
  /** Global shortcut that translates the current selection in any app. */
  hotkey: string
  bubble: { x: number; y: number } | null
  showBubble: boolean
}

export const defaults: Settings = {
  apiBase: process.env.TARJUMAN_API ?? "https://tarjuman-xi.vercel.app",
  from: "auto",
  to: "en",
  hotkey: "CommandOrControl+Shift+Y",
  bubble: null,
  showBubble: true,
}

/** Small JSON settings file in the app's user-data folder. Unknown or invalid values fall back to defaults. */
export class SettingsStore {
  private value: Settings
  readonly path: string

  constructor(dir: string) {
    this.path = join(dir, "settings.json")
    let stored: Partial<Settings> = {}
    try {
      stored = JSON.parse(readFileSync(this.path, "utf8")) as Partial<Settings>
    } catch {
      // First run or unreadable file: start from defaults.
    }
    this.value = { ...defaults, ...stored }
    if (!isLanguage(this.value.to)) this.value.to = defaults.to
    if (this.value.from !== "auto" && !isLanguage(this.value.from)) this.value.from = defaults.from
    if (process.env.TARJUMAN_API) this.value.apiBase = process.env.TARJUMAN_API
  }

  get(): Readonly<Settings> {
    return this.value
  }

  update(patch: Partial<Settings>) {
    this.value = { ...this.value, ...patch }
    try {
      writeFileSync(this.path, JSON.stringify(this.value, null, 2))
    } catch (error) {
      console.error("Could not save settings", error)
    }
  }
}
