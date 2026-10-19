import { arabicScriptRatio } from "@tarjuman/core/arabic"

export const MAX_TEXT = 4000
const MIN_BLOCK_TEXT = 15
const BLOCK_TAGS = new Set(["P", "DIV", "LI", "TD", "BLOCKQUOTE", "SECTION", "ARTICLE", "SPAN", "H1", "H2", "H3", "H4", "H5", "H6"])

/** Whether the page is mostly Arabic-script text, judged from a sample of its body. */
export function looksArabic(doc: Document): boolean {
  const sample = (doc.body?.innerText ?? doc.body?.textContent ?? "").slice(0, 5000)
  return arabicScriptRatio(sample) > 0.3
}

export function selectedText(win: Window): string {
  return (win.getSelection()?.toString() ?? "").trim().slice(0, MAX_TEXT)
}

/**
 * The smallest meaningful block of text around a clicked element: walks up from
 * the target until it reaches a block-level element with enough text.
 */
export function textBlockAt(target: Element | null, root: Element): HTMLElement | null {
  let node: Element | null = target
  while (node && node !== root) {
    const text = (node as HTMLElement).innerText ?? node.textContent ?? ""
    if (BLOCK_TAGS.has(node.tagName) && text.trim().length >= MIN_BLOCK_TEXT) return node as HTMLElement
    node = node.parentElement
  }
  return null
}

export function blockText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT)
}
