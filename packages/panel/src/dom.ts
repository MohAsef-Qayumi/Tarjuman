import { languages } from "@tarjuman/core/languages"

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") el.textContent = value
    else el.setAttribute(key, value)
  }
  el.append(...children)
  return el
}

export function languageSelect(value: string, includeAuto: boolean, label: string) {
  const select = h("select", { "aria-label": label })
  if (includeAuto) select.append(h("option", { value: "auto", text: "Auto" }))
  for (const [code, lang] of Object.entries(languages)) {
    if (!includeAuto && code === "ar") continue
    select.append(h("option", { value: code, text: lang.native }))
  }
  select.value = value
  return select
}
