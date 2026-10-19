import { beforeEach, describe, expect, it } from "vitest"
import { blockText, looksArabic, MAX_TEXT, textBlockAt } from "../src/page"

describe("page helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav><a id="link">Home</a></nav>
      <div id="book">
        <p id="para">قال الإمام الشافعي رحمه الله: <b id="bold">العلم</b> ما نفع، ليس العلم ما حفظ.</p>
        <span id="tiny">١٢</span>
      </div>`
  })

  it("detects Arabic pages", () => {
    expect(looksArabic(document)).toBe(true)
    document.body.innerHTML = "<p>An English page with only English text on it.</p>"
    expect(looksArabic(document)).toBe(false)
  })

  it("expands a click on an inline element to its paragraph", () => {
    const block = textBlockAt(document.getElementById("bold"), document.body)
    expect(block?.id).toBe("para")
  })

  it("skips elements with too little text and keeps walking up", () => {
    const block = textBlockAt(document.getElementById("tiny"), document.body)
    expect(block?.id).toBe("book")
  })

  it("returns null outside any text block", () => {
    expect(textBlockAt(document.getElementById("link"), document.body)).toBeNull()
  })

  it("caps the text sent for translation", () => {
    const el = document.createElement("p")
    el.textContent = "ب".repeat(MAX_TEXT + 500)
    expect(blockText(el)).toHaveLength(MAX_TEXT)
  })
})
