import { describe, expect, it } from "vitest"
import { arabicScriptRatio, hasDiacritics, normalizeArabic } from "./arabic"
import { relevantTerms } from "./glossary"

describe("normalizeArabic", () => {
  it("removes vowel marks and tatweel", () => {
    expect(normalizeArabic("الحَمْدُ لِلّٰهِ")).toBe("الحمد لله")
    expect(normalizeArabic("كـــتاب")).toBe("كتاب")
  })

  it("unifies letter variants that editions write differently", () => {
    expect(normalizeArabic("إجماع")).toBe(normalizeArabic("اجماع"))
    expect(normalizeArabic("صلاة")).toBe("صلاه")
    expect(normalizeArabic("على")).toBe("علي")
  })
})

describe("script detection", () => {
  it("measures the share of Arabic-script letters", () => {
    expect(arabicScriptRatio("قال رسول الله")).toBe(1)
    expect(arabicScriptRatio("hello")).toBe(0)
    expect(arabicScriptRatio("123 !!")).toBe(0)
  })

  it("detects diacritics", () => {
    expect(hasDiacritics("كَتَبَ")).toBe(true)
    expect(hasDiacritics("كتب")).toBe(false)
  })
})

describe("relevantTerms", () => {
  it("finds glossary terms regardless of vowel marks", () => {
    const terms = relevantTerms("وَهَذَا حَدِيثٌ صَحِيحٌ، وَعَلَيْهِ الإِجْمَاعُ")
    expect(terms.map((t) => t.translit)).toEqual(expect.arrayContaining(["ṣaḥīḥ", "ijmāʿ"]))
  })

  it("returns nothing for unrelated text", () => {
    expect(relevantTerms("ذهب الولد إلى السوق")).toEqual([])
  })
})
