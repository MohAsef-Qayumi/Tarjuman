import { contextBridge, ipcRenderer } from "electron"

/** Everything the panel page may do. It has no other access to Node or the system. */
contextBridge.exposeInMainWorld("tarjuman", {
  languages: () => ipcRenderer.invoke("panel:languages"),
  translate: (text: string, from: string, to: string) => ipcRenderer.invoke("panel:translate", text, from, to),
  lookup: (word: string, context: string, to: string) => ipcRenderer.invoke("panel:lookup", word, context, to),
  copy: (text: string) => ipcRenderer.invoke("panel:copy", text),
  setLanguages: (from: string, to: string) => ipcRenderer.send("panel:set-languages", from, to),
  hide: () => ipcRenderer.send("panel:hide"),
  onShow: (listener: (text: string) => void) => ipcRenderer.on("panel:show", (_e, text: string) => listener(text)),
  onEmpty: (listener: () => void) => ipcRenderer.on("panel:empty", () => listener()),
  onLanguages: (listener: (langs: { from: string; to: string }) => void) =>
    ipcRenderer.on("panel:languages", (_e, langs: { from: string; to: string }) => listener(langs)),
})
