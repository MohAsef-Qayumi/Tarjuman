import { languages, type LanguageCode, type SourceLanguage } from "@tarjuman/core/languages"
import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import { send } from "./messages"
import { blockText, looksArabic, selectedText, textBlockAt } from "./page"
import { loadSettings, saveSettings, type Settings } from "./settings"
import { styles } from "./styles"

const DRAG_THRESHOLD = 5

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") el.textContent = value
    else el.setAttribute(key, value)
  }
  el.append(...children)
  return el
}

function languageSelect(value: string, includeAuto: boolean, label: string) {
  const select = h("select", { "aria-label": label })
  if (includeAuto) select.append(h("option", { value: "auto", text: "Auto" }))
  for (const [code, lang] of Object.entries(languages)) {
    if (!includeAuto && code === "ar") continue
    select.append(h("option", { value: code, text: lang.native }))
  }
  select.value = value
  return select
}

class Tarjuman {
  private host = h("div", { id: "tarjuman-root" })
  private shadow = this.host.attachShadow({ mode: "open" })
  private root = h("div", { class: "root" })
  private fab = h("button", { class: "fab", "aria-label": "Translate with Tarjuman", "aria-pressed": "false", title: "Translate (select text, or click then pick a paragraph)", text: "ت" })
  private panel: HTMLElement | null = null
  private picking: { hint: HTMLElement; box: HTMLElement; cleanup: () => void } | null = null
  private source = ""
  private savedSelection = ""

  constructor(private settings: Settings) {
    this.shadow.append(h("style", { text: styles }), this.root)
    this.root.append(this.fab)
    this.placeFab()
    this.bindFab()
    document.documentElement.append(this.host)

    // Track the page selection, since on some devices tapping the button clears it.
    // Selections inside our own panel don't count.
    document.addEventListener("selectionchange", () => {
      if (!this.selectionIsOurs()) this.savedSelection = selectedText(window)
    })
  }

  private placeFab() {
    const pos = this.settings.buttonPosition ?? { right: 20, bottom: 20 }
    this.fab.style.right = `${pos.right}px`
    this.fab.style.bottom = `${pos.bottom}px`
  }

  private bindFab() {
    let start: { x: number; y: number; right: number; bottom: number } | null = null
    let dragged = false

    this.fab.addEventListener("pointerdown", (e) => {
      e.preventDefault() // keep the page selection
      this.fab.setPointerCapture(e.pointerId)
      const rect = this.fab.getBoundingClientRect()
      start = { x: e.clientX, y: e.clientY, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom }
      dragged = false
    })

    this.fab.addEventListener("pointermove", (e) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      dragged = true
      const right = Math.min(Math.max(start.right - dx, 4), innerWidth - 52)
      const bottom = Math.min(Math.max(start.bottom - dy, 4), innerHeight - 52)
      this.fab.style.right = `${right}px`
      this.fab.style.bottom = `${bottom}px`
    })

    this.fab.addEventListener("pointerup", () => {
      if (!start) return
      start = null
      if (dragged) {
        const rect = this.fab.getBoundingClientRect()
        this.settings.buttonPosition = { right: Math.round(innerWidth - rect.right), bottom: Math.round(innerHeight - rect.bottom) }
        void saveSettings({ buttonPosition: this.settings.buttonPosition })
        return
      }
      this.activate()
    })
  }

  /** Whether a node belongs to our UI. `contains` doesn't cross shadow boundaries, so check the root too. */
  private isOurs(node: Node | null | undefined) {
    return !!node && (node === this.host || node.getRootNode() === this.shadow)
  }

  private selectionIsOurs() {
    return this.isOurs(window.getSelection()?.anchorNode)
  }

  /** Selected text is translated straight away; otherwise the user picks a paragraph. */
  private activate() {
    if (this.picking) return this.stopPicking()
    const selection = (this.selectionIsOurs() ? "" : selectedText(window)) || this.savedSelection
    this.savedSelection = ""
    if (selection) return void this.translate(selection)
    this.startPicking()
  }

  private startPicking() {
    const hint = h("div", { class: "hint", role: "status", text: "Click a paragraph to translate · Esc to cancel" })
    const box = h("div", { class: "highlight" })
    box.hidden = true
    this.root.append(hint, box)
    this.fab.setAttribute("aria-pressed", "true")

    let current: HTMLElement | null = null
    const blockFrom = (e: Event) => {
      const target = e.composedPath()[0]
      if (!(target instanceof Element) || this.isOurs(target)) return null
      return textBlockAt(target, document.body)
    }
    const onMove = (e: MouseEvent) => {
      current = blockFrom(e)
      if (!current) return void (box.hidden = true)
      const r = current.getBoundingClientRect()
      Object.assign(box.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` })
      box.hidden = false
    }
    const onClick = (e: MouseEvent) => {
      const block = blockFrom(e)
      if (!block) return
      e.preventDefault()
      e.stopPropagation()
      this.stopPicking()
      void this.translate(blockText(block))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.stopPicking()
    }

    document.addEventListener("mousemove", onMove, true)
    document.addEventListener("click", onClick, true)
    document.addEventListener("keydown", onKey, true)
    this.picking = {
      hint,
      box,
      cleanup: () => {
        document.removeEventListener("mousemove", onMove, true)
        document.removeEventListener("click", onClick, true)
        document.removeEventListener("keydown", onKey, true)
      },
    }
  }

  private stopPicking() {
    if (!this.picking) return
    this.picking.cleanup()
    this.picking.hint.remove()
    this.picking.box.remove()
    this.picking = null
    this.fab.setAttribute("aria-pressed", "false")
  }

  private async translate(text: string) {
    this.source = text
    const body = this.openPanel()
    body.replaceChildren(h("p", { class: "status", text: "Translating…" }))

    const { from, to } = this.settings
    const reply = await send<TranslateResult>({ type: "translate", text, from, to })
    if (this.source !== text || !this.panel) return // superseded by a newer request
    if (!reply.ok) return void body.replaceChildren(h("p", { class: "error", role: "alert", text: reply.error }))
    this.renderResult(body, reply.data)
  }

  private openPanel(): HTMLElement {
    this.panel?.remove()
    const from = languageSelect(this.settings.from, true, "Translate from")
    const to = languageSelect(this.settings.to, false, "Translate to")
    const close = h("button", { class: "icon", "aria-label": "Close", text: "×" })
    const body = h("div", { class: "body" })
    const copy = h("button", { text: "Copy" })

    const onLanguage = () => {
      this.settings.from = from.value as SourceLanguage
      this.settings.to = to.value as LanguageCode
      void saveSettings({ from: this.settings.from, to: this.settings.to })
      if (this.source) void this.translate(this.source)
    }
    from.addEventListener("change", onLanguage)
    to.addEventListener("change", onLanguage)
    close.addEventListener("click", () => this.closePanel())
    copy.addEventListener("click", () => {
      const text = body.querySelector(".translation")?.textContent
      if (text) void navigator.clipboard.writeText(text).then(() => (copy.textContent = "Copied"))
    })

    this.panel = h(
      "section",
      { class: "panel", role: "dialog", "aria-label": "Tarjuman translation" },
      h("div", { class: "head" }, h("strong", { text: "Tarjuman" }), from, h("span", { text: "→" }), to, close),
      body,
      h("div", { class: "foot" }, h("span", { text: "Machine translation — verify rulings with a scholar." }), copy),
    )
    this.root.append(this.panel)
    return body
  }

  private closePanel() {
    this.panel?.remove()
    this.panel = null
    this.source = ""
  }

  private renderResult(body: HTMLElement, result: TranslateResult) {
    const dir = languages[this.settings.to].dir
    const translation = h("p", { class: `translation ${dir}`, dir, lang: this.settings.to, text: result.translation })
    body.replaceChildren(translation)

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
      if (!token.trim() || !/[؀-ۿ]/.test(token)) {
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
    const word = token.replace(/[^؀-ۿ]/g, "")
    if (!word) return
    info.hidden = false
    info.replaceChildren(h("span", { class: "status", text: `Looking up ${word}…` }))
    const reply = await send<WordResult>({ type: "word", word, context: this.source.slice(0, 600), to: this.settings.to })
    if (!reply.ok) return void info.replaceChildren(h("span", { class: "error", text: reply.error }))

    const w = reply.data
    const dir = languages[this.settings.to].dir
    const meta = [w.root && `Root: ${w.root}`, w.lemma && `Lemma: ${w.lemma}`, w.partOfSpeech].filter(Boolean).join(" · ")
    info.replaceChildren(
      h("div", { class: "ar", dir: "rtl", text: w.vocalized ?? w.word }),
      ...(meta ? [h("div", { class: "status", text: meta })] : []),
      ...(w.inContext ? [h("div", { dir, text: w.inContext })] : []),
      h("div", { class: "status", dir, text: w.meanings.join(" · ") }),
    )
  }
}

async function main() {
  if (window.top !== window || document.getElementById("tarjuman-root")) return
  const settings = await loadSettings()
  const onShamela = /(^|\.)shamela\.ws$/.test(location.hostname)
  if (onShamela || settings.everywhere || looksArabic(document)) new Tarjuman(settings)
}

void main()
