import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron"
import { join } from "node:path"
import { languages, type LanguageCode, type SourceLanguage } from "@tarjuman/core/languages"
import { Api } from "./api"
import { readSelection, sendCopyShortcut } from "./selection"
import { SettingsStore } from "./settings"

const BUBBLE_SIZE = 56
const PANEL = { width: 440, height: 600 }
// Give the user time to release the hotkey's modifier keys before we send Ctrl+C.
const HOTKEY_RELEASE_MS = 250

if (process.env.TARJUMAN_USER_DATA) app.setPath("userData", process.env.TARJUMAN_USER_DATA)
if (!app.requestSingleInstanceLock()) app.quit()

const asset = (name: string) => join(__dirname, name)

let settings: SettingsStore
let api: Api
let bubble: BrowserWindow
let panel: BrowserWindow
let tray: Tray
let dragOrigin: { x: number; y: number } | null = null
let quitting = false

function createBubble() {
  const area = screen.getPrimaryDisplay().workArea
  const pos = settings.get().bubble ?? { x: area.x + area.width - BUBBLE_SIZE - 24, y: area.y + area.height - BUBBLE_SIZE - 120 }
  bubble = new BrowserWindow({
    title: "Tarjuman bubble",
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Clicking the bubble must not take focus from Shamela, or the copy would target us.
    focusable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload: asset("preload-bubble.js"), sandbox: true, contextIsolation: true },
  })
  bubble.setAlwaysOnTop(true, "screen-saver")
  bubble.setVisibleOnAllWorkspaces(true)
  void bubble.loadFile(asset("bubble.html"))
  bubble.once("ready-to-show", () => settings.get().showBubble && bubble.showInactive())
}

function createPanel() {
  panel = new BrowserWindow({
    title: "Tarjuman",
    ...PANEL,
    minWidth: 340,
    minHeight: 320,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: { preload: asset("preload-panel.js"), sandbox: true, contextIsolation: true },
  })
  void panel.loadFile(asset("panel.html"))
  panel.on("close", (event) => {
    // Keep the window alive between translations; quitting goes through the tray.
    if (!quitting) {
      event.preventDefault()
      panel.hide()
    }
  })
}

/** Places the panel beside the bubble, kept inside the screen the bubble is on. */
function positionPanel() {
  const b = bubble.getBounds()
  const area = screen.getDisplayMatching(b).workArea
  const [width, height] = panel.getSize() as [number, number]
  const x = b.x - width - 12 >= area.x ? b.x - width - 12 : Math.min(b.x + b.width + 12, area.x + area.width - width)
  const y = Math.max(area.y, Math.min(b.y + b.height - height, area.y + area.height - height))
  panel.setPosition(Math.round(x), Math.round(y))
}

async function translateSelection(fromHotkey: boolean) {
  if (fromHotkey) await new Promise((r) => setTimeout(r, HOTKEY_RELEASE_MS))
  const text =
    process.env.TARJUMAN_TEST_SELECTION ??
    (await readSelection({ clipboard, platform: process.platform, sendCopy: () => sendCopyShortcut(process.platform) }))

  if (!panel.isVisible()) positionPanel()
  panel.showInactive()
  panel.webContents.send(text ? "panel:show" : "panel:empty", text)
}

function registerHotkey(accelerator: string) {
  globalShortcut.unregisterAll()
  const ok = globalShortcut.register(accelerator, () => void translateSelection(true))
  if (!ok) console.warn(`Could not register ${accelerator}; it may be used by another app.`)
}

function buildTrayMenu() {
  const s = settings.get()
  const targets = (Object.keys(languages) as LanguageCode[]).filter((c) => c !== "ar")
  const hotkeyLabel = s.hotkey.replace("CommandOrControl", process.platform === "darwin" ? "Cmd" : "Ctrl")
  return Menu.buildFromTemplate([
    { label: `Translate selection   ${hotkeyLabel}`, click: () => void translateSelection(false) },
    { label: "Show translation window", click: () => (positionPanel(), panel.show()) },
    {
      label: "Floating button",
      type: "checkbox",
      checked: s.showBubble,
      click: (item) => {
        settings.update({ showBubble: item.checked })
        if (item.checked) bubble.showInactive()
        else bubble.hide()
      },
    },
    { type: "separator" },
    {
      label: "Translate to",
      submenu: targets.map((code) => ({
        label: `${languages[code].name} — ${languages[code].native}`,
        type: "radio" as const,
        checked: s.to === code,
        click: () => setLanguages(s.from, code),
      })),
    },
    {
      label: process.platform === "darwin" ? "Open at login" : "Start with Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: "Open settings file", click: () => void shell.openPath(settings.path) },
    { type: "separator" },
    { label: "Quit Tarjuman", role: "quit" },
  ])
}

function setLanguages(from: SourceLanguage, to: LanguageCode) {
  settings.update({ from, to })
  tray.setContextMenu(buildTrayMenu())
  panel.webContents.send("panel:languages", { from, to })
}

function registerIpc() {
  ipcMain.on("bubble:click", () => void translateSelection(false))
  ipcMain.on("bubble:drag-start", () => {
    const [x, y] = bubble.getPosition() as [number, number]
    dragOrigin = { x, y }
  })
  ipcMain.on("bubble:drag", (_e, dx: number, dy: number) => {
    if (dragOrigin) bubble.setPosition(Math.round(dragOrigin.x + dx), Math.round(dragOrigin.y + dy))
  })
  ipcMain.on("bubble:drag-end", () => {
    dragOrigin = null
    const [x, y] = bubble.getPosition() as [number, number]
    settings.update({ bubble: { x, y } })
  })

  ipcMain.handle("panel:languages", () => ({ from: settings.get().from, to: settings.get().to }))
  ipcMain.handle("panel:translate", (_e, text: string, from: SourceLanguage, to: LanguageCode) => api.translate(text, from, to))
  ipcMain.handle("panel:lookup", (_e, word: string, context: string, to: LanguageCode) => api.lookup(word, context, to))
  ipcMain.handle("panel:copy", (_e, text: string) => clipboard.writeText(text))
  ipcMain.on("panel:set-languages", (_e, from: SourceLanguage, to: LanguageCode) => {
    settings.update({ from, to })
    tray.setContextMenu(buildTrayMenu())
  })
  ipcMain.on("panel:hide", () => panel.hide())
}

app.whenReady().then(() => {
  settings = new SettingsStore(app.getPath("userData"))
  api = new Api(app.getPath("userData"), () => settings.get().apiBase)
  app.setAppUserModelId("dev.tarjuman.desktop")

  createBubble()
  createPanel()
  registerIpc()
  registerHotkey(settings.get().hotkey)

  tray = new Tray(nativeImage.createFromPath(asset("icons/tray.png")))
  tray.setToolTip("Tarjuman — select Arabic text, then click ت")
  tray.setContextMenu(buildTrayMenu())
  tray.on("click", () => (positionPanel(), panel.show()))
})

app.on("second-instance", () => (positionPanel(), panel.show()))
app.on("before-quit", () => {
  quitting = true
  api?.flush()
})
app.on("will-quit", () => globalShortcut.unregisterAll())
// The app lives in the tray; closing windows must not quit it.
app.on("window-all-closed", () => {})
