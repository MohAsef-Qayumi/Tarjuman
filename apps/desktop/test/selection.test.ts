import { describe, expect, it, vi } from "vitest"
import { readSelection, type Clipboard } from "../src/main/selection"

function fakeClipboard(initial: { text?: string; html?: string; selection?: string } = {}) {
  const state = { text: initial.text ?? "", html: initial.html ?? "", selection: initial.selection ?? "" }
  const clipboard: Clipboard = {
    readText: (type) => (type === "selection" ? state.selection : state.text),
    writeText: (text) => void (state.text = text),
    readHTML: () => state.html,
    write: (data) => {
      state.text = data.text ?? ""
      state.html = data.html ?? ""
    },
    clear: () => {
      state.text = ""
      state.html = ""
    },
  }
  return { clipboard, state }
}

describe("readSelection", () => {
  it("copies the selection and restores the user's clipboard", async () => {
    const { clipboard, state } = fakeClipboard({ text: "my notes", html: "<b>my notes</b>" })
    const sendCopy = vi.fn(async () => void (state.text = "قال رسول الله"))

    const text = await readSelection({ clipboard, platform: "win32", sendCopy })

    expect(text).toBe("قال رسول الله")
    expect(state).toMatchObject({ text: "my notes", html: "<b>my notes</b>" })
  })

  it("returns nothing when no text is selected, leaving the clipboard as it was", async () => {
    const { clipboard, state } = fakeClipboard({ text: "keep me" })
    const text = await readSelection({ clipboard, platform: "win32", sendCopy: async () => {}, timeoutMs: 80 })
    expect(text).toBe("")
    expect(state.text).toBe("keep me")
  })

  it("waits for apps that copy slowly", async () => {
    const { clipboard, state } = fakeClipboard()
    const sendCopy = async () => void setTimeout(() => (state.text = "نص"), 120)
    expect(await readSelection({ clipboard, platform: "win32", sendCopy })).toBe("نص")
  })

  it("never returns stale clipboard contents as the selection", async () => {
    const { clipboard } = fakeClipboard({ text: "old clipboard text" })
    expect(await readSelection({ clipboard, platform: "darwin", sendCopy: async () => {}, timeoutMs: 80 })).toBe("")
  })

  it("uses the PRIMARY selection on Linux without touching the clipboard", async () => {
    const { clipboard } = fakeClipboard({ selection: "  متن  ", text: "clip" })
    const sendCopy = vi.fn()
    expect(await readSelection({ clipboard, platform: "linux", sendCopy })).toBe("متن")
    expect(sendCopy).not.toHaveBeenCalled()
  })
})
