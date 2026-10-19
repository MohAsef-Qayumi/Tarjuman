import type { TranslateResult, WordResult } from "@tarjuman/core/schema"
import { h, TranslationPanel } from "@tarjuman/panel"
import { send } from "./messages"
import { blockText, looksArabic, selectedText, textBlockAt } from "./page"
import { loadSettings, saveSettings, type Settings } from "./settings"
import { styles } from "./styles"

const DRAG_THRESHOLD = 5

class Tarjuman {
  private host = h("div", { id: "tarjuman-root" })
  private shadow = this.host.attachShadow({ mode: "open" })
  private root = h("div", { class: "root" })
  private fab = h("button", { class: "fab", "aria-label": "Translate with Tarjuman", "aria-pressed": "false", title: "Translate (select text, or click then pick a paragraph)", text: "ت" })
  private panel: TranslationPanel
  private picking: { hint: HTMLElement; box: HTMLElement; cleanup: () => void } | null = null
  private savedSelection = ""

  constructor(private settings: Settings) {
    this.panel = new TranslationPanel({
      mount: this.root,
      languages: { from: settings.from, to: settings.to },
      translate: (text, from, to) => send<TranslateResult>({ type: "translate", text, from, to }),
      lookup: (word, context, to) => send<WordResult>({ type: "word", word, context, to }),
      onLanguageChange: (from, to) => {
        Object.assign(this.settings, { from, to })
        void saveSettings({ from, to })
      },
    })
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
    if (selection) return this.translate(selection)
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
      this.translate(blockText(block))
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

  private translate(text: string) {
    void this.panel.show(text)
  }
}

async function main() {
  if (window.top !== window || document.getElementById("tarjuman-root")) return
  const settings = await loadSettings()
  const onShamela = /(^|\.)shamela\.ws$/.test(location.hostname)
  if (onShamela || settings.everywhere || looksArabic(document)) new Tarjuman(settings)
}

void main()
