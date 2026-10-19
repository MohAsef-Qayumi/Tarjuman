// End-to-end test: launches the real Electron app against the API in mock
// mode and drives the bubble and the panel. On Linux CI run under xvfb-run.
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import electronPath from "electron"
import { _electron as electron } from "playwright"

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const API_PORT = 3302
const SELECTION = "قَالَ أَهْلُ العِلْمِ: هَذَا حَدِيثٌ صَحِيحٌ"
let failures = 0
const check = (label, pass) => {
  console.log(`${pass ? "✓" : "✗"} ${label}`)
  if (!pass) failures++
}

const api = spawn("npx", ["next", "start", "-p", String(API_PORT)], {
  cwd: here("../../web"),
  env: { ...process.env, TARJUMAN_MOCK: "1", RATE_LIMIT_PER_MINUTE: "1000" },
  stdio: "ignore",
})

async function launch(selection, userData) {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [here("..")],
    env: {
      ...process.env,
      TARJUMAN_API: `http://localhost:${API_PORT}`,
      TARJUMAN_TEST_SELECTION: selection,
      TARJUMAN_USER_DATA: userData,
    },
  })
  const windows = async () => {
    for (let i = 0; i < 50 && app.windows().length < 2; i++) await sleep(200)
    const all = app.windows()
    return {
      bubble: all.find((w) => w.url().endsWith("/bubble.html")),
      panel: all.find((w) => w.url().endsWith("/panel.html")),
    }
  }
  return { app, ...(await windows()) }
}

try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`http://localhost:${API_PORT}/api/health`).then((r) => r.ok, () => false)) break
    await sleep(500)
  }
  const userData = mkdtempSync(join(tmpdir(), "tarjuman-desktop-"))

  // 1. Selection → translation
  let { app, bubble, panel } = await launch(SELECTION, userData)
  check("bubble and panel windows open", !!bubble && !!panel)
  const bubbleProps = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Tarjuman bubble")
    return { onTop: w.isAlwaysOnTop(), focusable: w.isFocusable(), visible: w.isVisible() }
  })
  check("bubble floats on top without taking focus", bubbleProps.onTop && !bubbleProps.focusable && bubbleProps.visible)
  check("global shortcut registered", await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered("CommandOrControl+Shift+Y")))

  await bubble.click("#bubble")
  await panel.locator(".translation").waitFor({ timeout: 15_000 })
  check("clicking the bubble translates the selection", (await panel.locator(".translation").innerText()).includes("mock translation"))
  check(
    "panel window becomes visible",
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Tarjuman").isVisible()),
  )
  await panel.screenshot({ path: join(tmpdir(), "tarjuman-desktop-panel.png") })

  await panel.locator(".word").nth(2).click()
  await panel.locator(".wordinfo", { hasText: "Root" }).waitFor({ timeout: 10_000 })
  check("tapping a word shows its root", true)

  await panel.locator('select[aria-label="Translate to"]').selectOption("fa")
  await panel.locator(".translation[lang=fa]").waitFor({ timeout: 10_000 })
  check("changing language re-translates", (await panel.locator(".translation").getAttribute("dir")) === "rtl")

  await panel.click("button[aria-label=Close]")
  await sleep(300)
  check(
    "closing hides the panel but keeps the app running",
    !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle() === "Tarjuman").isVisible())),
  )
  await app.close()

  const saved = JSON.parse(readFileSync(join(userData, "settings.json"), "utf8"))
  check("language choice saved to settings", saved.to === "fa")
  const cache = JSON.parse(readFileSync(join(userData, "cache.json"), "utf8"))
  check(`translations cached on disk (${cache.length})`, cache.length >= 2)

  // 2. Nothing selected → helpful empty state, no request
  ;({ app, bubble, panel } = await launch("", userData))
  await bubble.click("#bubble")
  await panel.locator(".empty").waitFor({ timeout: 10_000 })
  check("with nothing selected, explains what to do", (await panel.locator(".empty").innerText()).includes("Select Arabic text"))
  check("remembered language on restart", (await panel.evaluate(() => window.tarjuman.languages())).to === "fa")
  await app.close()
} finally {
  api.kill()
}

process.exit(failures ? 1 : 0)
