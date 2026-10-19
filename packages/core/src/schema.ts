import { z } from "zod"
import { languageCodes, type LanguageCode } from "./languages"

const lang = z.enum(languageCodes as [LanguageCode, ...LanguageCode[]])

export const MAX_TEXT_LENGTH = 4000

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  from: z.union([lang, z.literal("auto")]).default("auto"),
  to: lang,
})

export const wordRequestSchema = z.object({
  word: z.string().trim().min(1).max(60),
  context: z.string().trim().max(600).default(""),
  to: lang,
})

export const translationSchema = z.object({
  translation: z.string().min(1),
  detectedLanguage: lang.optional(),
  terms: z
    .array(z.object({ term: z.string(), translit: z.string().optional(), meaning: z.string() }))
    .max(20)
    .default([]),
})

export const wordInfoSchema = z.object({
  word: z.string(),
  vocalized: z.string().optional(),
  root: z.string().optional(),
  lemma: z.string().optional(),
  partOfSpeech: z.string().optional(),
  meanings: z.array(z.string()).min(1).max(8),
  inContext: z.string().optional(),
})

export type TranslateRequest = z.infer<typeof translateRequestSchema>
export type WordRequest = z.infer<typeof wordRequestSchema>
export type Translation = z.infer<typeof translationSchema>
export type WordInfo = z.infer<typeof wordInfoSchema>

export type TranslateResult = Translation & { cached: boolean; provider: string }
export type WordResult = WordInfo & { cached: boolean; provider: string }
