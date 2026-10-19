// End-to-end test: loads the built extension into Chromium, serves a
// Shamela-style page and runs the API in mock mode (no AI key needed).
// Usage: npm run build:test && npm run e2e
import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const API_PORT = 3301
const PAGE_PORT = 3401
let failures = 0
const check = (label, pass) => {
  console.log(`${pass ? "✓" : "✗"} ${label}`)
  if (!pass) failures++
}

const html = await readFile(here("./fixture.html"))
const pageServer = createServer((_req, res) => res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(html)).listen(PAGE_PORT)
const api = spawn("npx", ["next", "start", "-p", String(API_PORT)], {
  cwd: here("../../web"),
  env: { ...process.env, TARJUMAN_MOCK: "1", RATE_LIMIT_PER_MINUTE: "1000" },
  stdio: "ignore",
})

try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`http://localhost:${API_PORT}/api/health`).then((r) => r.ok, () => false)) break
    await sleep(500)
  }

  const ext = here("../dist")
  const context = await chromium.launchPersistentContext("", {
    executablePath: process.env.CHROMIUM_PATH,
    channel: process.env.CHROMIUM_PATH ? undefined : "chromium",
    headless: true,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  })
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`http://localhost:${PAGE_PORT}/`)

  const root = page.locator("#tarjuman-root")
  const fab = root.locator("button.fab")
  const panel = root.locator(".panel")
  await fab.waitFor({ timeout: 10_000 })
  check("button appears on an Arabic page", true)

  await page.evaluate(() => {
    const range = document.createRange()
    range.selectNodeContents(document.getElementById("p2"))
    getSelection().removeAllRanges()
    getSelection().addRange(range)
  })
  await fab.click()
  await panel.locator(".translation").waitFor({ timeout: 15_000 })
  check("selected text is translated", (await panel.locator(".translation").innerText()).includes("mock translation"))

  await panel.locator(".word").nth(3).click()
  await panel.locator(".wordinfo", { hasText: "Root" }).waitFor({ timeout: 10_000 })
  check("tapping a word shows its root", true)

  await panel.locator('select[aria-label="Translate to"]').selectOption("ps")
  await panel.locator(".translation[lang=ps]").waitFor({ timeout: 10_000 })
  check("changing language re-translates right-to-left", (await panel.locator(".translation").getAttribute("dir")) === "rtl")
  await panel.locator("button[aria-label=Close]").click()

  await page.evaluate(() => getSelection().removeAllRanges())
  await fab.click()
  await root.locator(".hint").waitFor({ timeout: 5_000 })
  await page.click("#p1")
  await panel.locator(".translation").waitFor({ timeout: 15_000 })
  check("pick mode translates the clicked paragraph", (await panel.locator(".translation").innerText()).includes("mock translation"))
  check("language choice is remembered", (await panel.locator('select[aria-label="Translate to"]').inputValue()) === "ps")

  const cached = await worker.evaluate(async () => (await chrome.storage.local.get("cache-index"))["cache-index"]?.length ?? 0)
  check(`results are cached on the device (${cached})`, cached >= 3)

  const english = await context.newPage()
  await english.goto("data:text/html,<p>An English page with plenty of English text.</p>")
  await english.waitForTimeout(1500)
  check("button stays hidden on non-Arabic pages", (await english.locator("#tarjuman-root").count()) === 0)
  check("no page errors", errors.length === 0)

  await context.close()
} finally {
  api.kill()
  pageServer.close()
}

process.exit(failures ? 1 : 0)
