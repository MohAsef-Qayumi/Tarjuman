import { relevantTerms } from "./glossary"
import { languages, type LanguageCode, type SourceLanguage } from "./languages"

/** Bump when prompts change so cached results from older prompts are not reused. */
export const PROMPT_VERSION = 1

export type ChatMessage = { role: "system" | "user"; content: string }

const TRANSLATE_SYSTEM = `You translate classical and modern Islamic Arabic texts (fiqh, hadith, tafsir, aqida, sira, Arabic grammar) for students who cannot read Arabic fluently.

Rules:
- Translate faithfully and completely. Do not summarise, explain, add commentary or omit anything.
- Keep the paragraph structure of the source.
- Quranic verses: keep the reference if one is given and translate the meaning, prefixed with "(meaning)". Never invent verse numbers.
- Hadith chains (isnād): transliterate narrator names, keep "narrated to us" / "from" structure.
- Names of people, places and books: transliterate, do not translate.
- Honorifics such as ﷺ, رضي الله عنه, رحمه الله: render with the conventional equivalent in the target language.
- Technical terms: use the meanings from the glossary when the word is used in its technical sense, and list each technical term you translated in "terms".
- If the source is already in the target language, return it unchanged.

Respond with JSON only, matching:
{"translation": string, "detectedLanguage": language code, "terms": [{"term": string, "translit": string, "meaning": string}]}`

export function translateMessages(text: string, from: SourceLanguage, to: LanguageCode): ChatMessage[] {
  const terms = relevantTerms(text)
  const glossary = terms.length
    ? `\n\nGlossary for this passage:\n${terms.map((t) => `- ${t.ar} (${t.translit}): ${t.meaning}`).join("\n")}`
    : ""
  const source = from === "auto" ? "Detect the source language." : `Source language: ${languages[from].name}.`
  const target = languages[to]

  return [
    { role: "system", content: TRANSLATE_SYSTEM },
    {
      role: "user",
      content: `${source}\nTarget language: ${target.name} (${target.native}). Write "translation" and each "meaning" in ${target.name}.${glossary}\n\n<passage>\n${text}\n</passage>`,
    },
  ]
}

const WORD_SYSTEM = `You are an Arabic morphology and lexicon assistant for students of classical Islamic texts.
Given one Arabic word and the sentence it appears in, analyse it.

Respond with JSON only, matching:
{"word": string, "vocalized": string (fully voweled as used in context), "root": string (letters separated by spaces), "lemma": string, "partOfSpeech": string, "meanings": string[] (most common first), "inContext": string (its meaning in this sentence)}`

export function wordMessages(word: string, context: string, to: LanguageCode): ChatMessage[] {
  return [
    { role: "system", content: WORD_SYSTEM },
    {
      role: "user",
      content: `Write partOfSpeech, meanings and inContext in ${languages[to].name}.\nWord: ${word}\nSentence: ${context || "(none given)"}`,
    },
  ]
}
