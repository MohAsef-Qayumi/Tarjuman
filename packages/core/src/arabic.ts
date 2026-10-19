/** Harakat, tanwin, shadda, sukun, dagger alif and Quranic annotation marks. */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g
const TATWEEL = /ـ/g

/**
 * Canonical form for matching, not for display: removes vowel marks and
 * unifies letter variants that are written inconsistently across editions.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
}

const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿ]/g
const ANY_LETTER = /\p{L}/gu

/** Share of letters that are Arabic script (also true for Persian, Pashto, Urdu). */
export function arabicScriptRatio(text: string): number {
  const letters = text.match(ANY_LETTER)?.length ?? 0
  if (letters === 0) return 0
  return (text.match(ARABIC_LETTER)?.length ?? 0) / letters
}

export function hasDiacritics(text: string): boolean {
  return /[ً-ْ]/.test(text)
}
