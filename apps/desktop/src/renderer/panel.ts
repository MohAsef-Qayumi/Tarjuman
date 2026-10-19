import { h, TranslationPanel } from "@tarjuman/panel"

const mount = document.getElementById("app")!

async function init() {
  const panel = new TranslationPanel({
    mount,
    docked: true,
    languages: await window.tarjuman.languages(),
    translate: (text, from, to) => window.tarjuman.translate(text, from, to),
    lookup: (word, context, to) => window.tarjuman.lookup(word, context, to),
    onLanguageChange: (from, to) => window.tarjuman.setLanguages(from, to),
    copy: (text) => window.tarjuman.copy(text),
    onClose: () => window.tarjuman.hide(),
  })

  const empty = h(
    "div",
    { class: "empty" },
    h("p", { class: "ar", dir: "rtl", text: "تُرجمان" }),
    h("p", { text: "Select Arabic text in Shamela (or any app), then click the ت button or press Ctrl+Shift+Y." }),
  )

  const showEmpty = () => {
    panel.reset()
    mount.replaceChildren(empty)
  }

  window.tarjuman.onShow((text) => {
    empty.remove()
    void panel.show(text)
  })
  window.tarjuman.onEmpty(showEmpty)
  window.tarjuman.onLanguages((langs) => panel.setLanguages(langs))
  showEmpty()
}

void init()
