import { languages, type LanguageCode, type SourceLanguage } from "@tarjuman/core/languages"
import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import { h, languageSelect } from "./dom"

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type PanelOptions = {
  /** Where the panel is mounted (a shadow root in the extension, the window body on desktop). */
  mount: ParentNode
  /** Fill the container instead of floating over the page. */
  docked?: boolean
  languages: { from: SourceLanguage; to: LanguageCode }
  translate: (text: string, from: SourceLanguage, to: LanguageCode) => Promise<Result<TranslateResult>>
  lookup: (word: string, context: string, to: LanguageCode) => Promise<Result<WordResult>>
  onLanguageChange?: (from: SourceLanguage, to: LanguageCode) => void
  onClose?: () => void
  copy?: (text: string) => Promise<void>
}

const ARABIC_LETTER = /[؀-ۿ]/
const NON_ARABIC = /[^؀-ۿ]/g

/**
 * The translation view: language pickers, the translation, technical terms,
 * and the original text with tap-a-word lookup.
 */
export class TranslationPanel {
  private el: HTMLElement | null = null
  private body: HTMLElement | null = null
  private source = ""
  private langs: { from: SourceLanguage; to: LanguageCode }

  constructor(private readonly options: PanelOptions) {
    this.langs = { ...options.languages }
  }

  get isOpen() {
    return this.el !== null
  }

  async show(text: string) {
    this.source = text
    const body = this.open()
    body.replaceChildren(h("p", { class: "status", text: "Translating…" }))

    const { from, to } = this.langs
    const reply = await this.options.translate(text, from, to)
    if (this.source !== text || this.body !== body) return // superseded by a newer request
    if (!reply.ok) return void body.replaceChildren(h("p", { class: "error", role: "alert", text: reply.error }))
    this.render(body, reply.data)
  }

  /** Closed by the user: removes the panel and notifies the host. */
  close() {
    this.reset()
    this.options.onClose?.()
  }

  /** Removes the panel without notifying the host (e.g. to show an empty state). */
  reset() {
    this.el?.remove()
    this.el = null
    this.body = null
    this.source = ""
  }

  /** Languages changed elsewhere (e.g. a tray menu): update the pickers and re-translate. */
  setLanguages(langs: { from: SourceLanguage; to: LanguageCode }) {
    this.langs = { ...langs }
    const [from, to] = Array.from(this.el?.querySelectorAll("select") ?? [])
    if (from) from.value = langs.from
    if (to) to.value = langs.to
    if (this.source) void this.show(this.source)
  }

  private open(): HTMLElement {
    if (this.el && this.body) return this.body

    const from = languageSelect(this.langs.from, true, "Translate from")
    const to = languageSelect(this.langs.to, false, "Translate to")
    const close = h("button", { class: "icon", "aria-label": "Close", text: "×" })
    const body = h("div", { class: "body" })
    const copy = h("button", { text: "Copy" })

    const onLanguage = () => {
      this.langs = { from: from.value as SourceLanguage, to: to.value as LanguageCode }
      this.options.onLanguageChange?.(this.langs.from, this.langs.to)
      if (this.source) void this.show(this.source)
    }
    from.addEventListener("change", onLanguage)
    to.addEventListener("change", onLanguage)
    close.addEventListener("click", () => this.close())
    copy.addEventListener("click", () => {
      const text = body.querySelector(".translation")?.textContent
      const write = this.options.copy ?? ((t: string) => navigator.clipboard.writeText(t))
      if (text) void write(text).then(() => (copy.textContent = "Copied"))
    })

    this.el = h(
      "section",
      { class: `panel${this.options.docked ? " docked" : ""}`, role: "dialog", "aria-label": "Tarjuman translation" },
      h("div", { class: "head" }, h("strong", { text: "Tarjuman" }), from, h("span", { text: "→" }), to, close),
      body,
      h("div", { class: "foot" }, h("span", { text: "Machine translation — verify rulings with a scholar." }), copy),
    )
    this.body = body
    this.options.mount.append(this.el)
    return body
  }

  private render(body: HTMLElement, result: TranslateResult) {
    const { to } = this.langs
    const dir = languages[to].dir
    body.replaceChildren(h("p", { class: `translation ${dir}`, dir, lang: to, text: result.translation }))

    if (result.terms.length) {
      const terms = h("dl", { class: "terms" })
      for (const t of result.terms) {
        terms.append(h("div", {}, h("dt", { lang: "ar", text: t.term }), h("dd", { dir, text: ` ${t.translit ? `(${t.translit}) ` : ""}— ${t.meaning}` })))
      }
      body.append(terms)
    }

    const original = h("p", { class: "original ar", dir: "rtl", lang: "ar" })
    const info = h("div", { class: "wordinfo" })
    info.hidden = true
    for (const token of this.source.split(/(\s+)/)) {
      if (!token.trim() || !ARABIC_LETTER.test(token)) {
        original.append(token)
        continue
      }
      const word = h("span", { class: "word", role: "button", tabindex: "0", text: token })
      const open = () => {
        original.querySelectorAll(".active").forEach((el) => el.classList.remove("active"))
        word.classList.add("active")
        void this.lookup(token, info)
      }
      word.addEventListener("click", open)
      word.addEventListener("keydown", (e) => e.key === "Enter" && open())
      original.append(word)
    }
    body.append(h("p", { class: "label", text: "Original — tap a word" }), original, info)
  }

  private async lookup(token: string, info: HTMLElement) {
    const word = token.replace(NON_ARABIC, "")
    if (!word) return
    const { to } = this.langs
    info.hidden = false
    info.replaceChildren(h("span", { class: "status", text: `Looking up ${word}…` }))
    const reply = await this.options.lookup(word, this.source.slice(0, 600), to)
    if (!reply.ok) return void info.replaceChildren(h("span", { class: "error", text: reply.error }))

    const w = reply.data
    const dir = languages[to].dir
    const meta = [w.root && `Root: ${w.root}`, w.lemma && `Lemma: ${w.lemma}`, w.partOfSpeech].filter(Boolean).join(" · ")
    info.replaceChildren(
      h("div", { class: "ar", dir: "rtl", text: w.vocalized ?? w.word }),
      ...(meta ? [h("div", { class: "status", text: meta })] : []),
      ...(w.inContext ? [h("div", { dir, text: w.inContext })] : []),
      h("div", { class: "status", dir, text: w.meanings.join(" · ") }),
    )
  }
}
