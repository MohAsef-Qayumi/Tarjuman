import { languages, type LanguageCode } from "@tarjuman/core/languages"
import { loadSettings, saveSettings } from "./settings"

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

async function init() {
  const settings = await loadSettings()
  const to = $<HTMLSelectElement>("to")
  const everywhere = $<HTMLInputElement>("everywhere")
  const apiBase = $<HTMLInputElement>("apiBase")
  const saved = $<HTMLDivElement>("saved")

  for (const [code, lang] of Object.entries(languages)) {
    if (code !== "ar") to.append(new Option(`${lang.name} — ${lang.native}`, code))
  }
  to.value = settings.to
  everywhere.checked = settings.everywhere
  apiBase.value = settings.apiBase

  const confirm = () => {
    saved.textContent = "Saved. Reload open pages to apply."
  }
  to.addEventListener("change", () => void saveSettings({ to: to.value as LanguageCode }).then(confirm))
  everywhere.addEventListener("change", () => void saveSettings({ everywhere: everywhere.checked }).then(confirm))
  apiBase.addEventListener("change", () => {
    if (apiBase.checkValidity()) void saveSettings({ apiBase: apiBase.value.replace(/\/+$/, "") }).then(confirm)
  })
}

void init()
