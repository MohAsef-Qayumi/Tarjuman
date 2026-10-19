export const languages = {
  ar: { name: "Arabic", native: "العربية", dir: "rtl" },
  en: { name: "English", native: "English", dir: "ltr" },
  fa: { name: "Dari (Persian)", native: "دری", dir: "rtl" },
  ps: { name: "Pashto", native: "پښتو", dir: "rtl" },
  ur: { name: "Urdu", native: "اردو", dir: "rtl" },
  tr: { name: "Turkish", native: "Türkçe", dir: "ltr" },
  id: { name: "Indonesian", native: "Bahasa Indonesia", dir: "ltr" },
} as const

export type LanguageCode = keyof typeof languages
export type SourceLanguage = LanguageCode | "auto"

export const languageCodes = Object.keys(languages) as LanguageCode[]

export const isLanguage = (value: unknown): value is LanguageCode =>
  typeof value === "string" && value in languages
