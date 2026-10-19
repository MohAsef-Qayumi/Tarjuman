import { execFile } from "node:child_process"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The subset of Electron's clipboard used here, so the logic can be unit-tested. */
export type Clipboard = {
  readText(type?: "selection" | "clipboard"): string
  writeText(text: string, type?: "selection" | "clipboard"): void
  readHTML(): string
  write(data: { text?: string; html?: string }): void
  clear(): void
}

export type SelectionDeps = {
  clipboard: Clipboard
  platform: NodeJS.Platform
  /** Sends the platform's copy shortcut to the app that has focus. */
  sendCopy: () => Promise<void>
  timeoutMs?: number
}

/**
 * Reads the text selected in whatever app has focus (e.g. Shamela).
 *
 * Linux exposes the selection directly (the X11 PRIMARY selection). Windows and
 * macOS have no such API, so we briefly use the clipboard: clear it, send the
 * copy shortcut to the focused app, wait for text to appear, then put the
 * user's original clipboard contents back.
 */
export async function readSelection({ clipboard, platform, sendCopy, timeoutMs = 800 }: SelectionDeps): Promise<string> {
  if (platform === "linux") {
    const primary = clipboard.readText("selection").trim()
    if (primary) return primary
  }

  const saved = { text: clipboard.readText(), html: clipboard.readHTML() }
  clipboard.clear()
  try {
    await sendCopy()
    for (let waited = 0; waited < timeoutMs; waited += 40) {
      const text = clipboard.readText().trim()
      if (text) return text
      await sleep(40)
    }
    return ""
  } finally {
    if (saved.text || saved.html) clipboard.write(saved)
    else clipboard.clear()
  }
}

let vbsPath: string | undefined

/** Native "press Ctrl+C / Cmd+C" without bundling native modules. */
export async function sendCopyShortcut(platform: NodeJS.Platform) {
  if (platform === "win32") {
    // WSH starts much faster than PowerShell, which matters for a snappy translate.
    vbsPath ??= (() => {
      const path = join(tmpdir(), "tarjuman-copy.vbs")
      writeFileSync(path, 'CreateObject("WScript.Shell").SendKeys "^c"\r\n')
      return path
    })()
    await run("cscript.exe", ["//nologo", "//B", vbsPath], { windowsHide: true })
  } else if (platform === "darwin") {
    // Requires Accessibility permission for Tarjuman (System Settings → Privacy & Security).
    await run("osascript", ["-e", 'tell application "System Events" to keystroke "c" using command down'])
  } else {
    await run("xdotool", ["key", "--clearmodifiers", "ctrl+c"]).catch(() => undefined)
  }
}
