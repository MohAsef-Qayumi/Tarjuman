import { normalizeArabic } from "./arabic"

export type GlossaryEntry = {
  ar: string
  translit: string
  meaning: string
}

/**
 * Technical vocabulary that general-purpose translators routinely get wrong.
 * Only entries that occur in the passage are sent to the model, which keeps
 * prompts short and the guidance relevant.
 */
export const glossary: GlossaryEntry[] = [
  // Hadith sciences
  { ar: "إسناد", translit: "isnād", meaning: "chain of narrators" },
  { ar: "متن", translit: "matn", meaning: "text of a hadith (as opposed to its chain)" },
  { ar: "حديث صحيح", translit: "ṣaḥīḥ", meaning: "authentic hadith" },
  { ar: "حسن", translit: "ḥasan", meaning: "sound/good hadith (grade below ṣaḥīḥ)" },
  { ar: "ضعيف", translit: "ḍaʿīf", meaning: "weak hadith" },
  { ar: "موضوع", translit: "mawḍūʿ", meaning: "fabricated hadith" },
  { ar: "مرسل", translit: "mursal", meaning: "hadith whose chain omits the Companion" },
  { ar: "متواتر", translit: "mutawātir", meaning: "mass-transmitted report" },
  { ar: "آحاد", translit: "āḥād", meaning: "solitary-chain reports" },
  { ar: "مرفوع", translit: "marfūʿ", meaning: "attributed to the Prophet ﷺ" },
  { ar: "موقوف", translit: "mawqūf", meaning: "attributed to a Companion" },
  { ar: "حدثنا", translit: "ḥaddathanā", meaning: "narrated to us" },
  { ar: "أخبرنا", translit: "akhbaranā", meaning: "informed us" },
  { ar: "الجرح والتعديل", translit: "al-jarḥ wa-l-taʿdīl", meaning: "criticism and accreditation of narrators" },
  { ar: "ثقة", translit: "thiqa", meaning: "reliable (narrator)" },

  // Fiqh and usul
  { ar: "واجب", translit: "wājib", meaning: "obligatory" },
  { ar: "فرض", translit: "farḍ", meaning: "obligatory duty" },
  { ar: "فرض كفاية", translit: "farḍ kifāya", meaning: "communal obligation" },
  { ar: "فرض عين", translit: "farḍ ʿayn", meaning: "individual obligation" },
  { ar: "مندوب", translit: "mandūb", meaning: "recommended" },
  { ar: "مستحب", translit: "mustaḥabb", meaning: "recommended" },
  { ar: "سنة مؤكدة", translit: "sunna muʾakkada", meaning: "emphasised Sunnah" },
  { ar: "مباح", translit: "mubāḥ", meaning: "permissible" },
  { ar: "مكروه", translit: "makrūh", meaning: "disliked" },
  { ar: "حرام", translit: "ḥarām", meaning: "forbidden" },
  { ar: "إجماع", translit: "ijmāʿ", meaning: "scholarly consensus" },
  { ar: "قياس", translit: "qiyās", meaning: "analogical reasoning" },
  { ar: "اجتهاد", translit: "ijtihād", meaning: "independent legal reasoning" },
  { ar: "تقليد", translit: "taqlīd", meaning: "following a school's rulings" },
  { ar: "مذهب", translit: "madhhab", meaning: "school of law" },
  { ar: "علة", translit: "ʿilla", meaning: "effective cause (in qiyās); hidden defect (in hadith)" },
  { ar: "ناسخ", translit: "nāsikh", meaning: "abrogating (text)" },
  { ar: "منسوخ", translit: "mansūkh", meaning: "abrogated (text)" },
  { ar: "الراجح", translit: "al-rājiḥ", meaning: "the preponderant (stronger) opinion" },
  { ar: "المعتمد", translit: "al-muʿtamad", meaning: "the relied-upon position of a school" },
  { ar: "خلاف", translit: "khilāf", meaning: "scholarly disagreement" },

  // Worship
  { ar: "طهارة", translit: "ṭahāra", meaning: "ritual purity" },
  { ar: "وضوء", translit: "wuḍūʾ", meaning: "ritual ablution" },
  { ar: "غسل", translit: "ghusl", meaning: "ritual full-body wash" },
  { ar: "تيمم", translit: "tayammum", meaning: "dry ablution" },
  { ar: "نجاسة", translit: "najāsa", meaning: "ritual impurity" },
  { ar: "زكاة", translit: "zakāh", meaning: "obligatory alms" },
  { ar: "نصاب", translit: "niṣāb", meaning: "minimum threshold for zakāh" },
  { ar: "اعتكاف", translit: "iʿtikāf", meaning: "devotional retreat in the mosque" },
  { ar: "عقيقة", translit: "ʿaqīqa", meaning: "sacrifice for a newborn" },

  // Creed and Quranic sciences
  { ar: "توحيد", translit: "tawḥīd", meaning: "affirmation of God's oneness" },
  { ar: "شرك", translit: "shirk", meaning: "associating partners with God" },
  { ar: "بدعة", translit: "bidʿa", meaning: "religious innovation" },
  { ar: "تفسير", translit: "tafsīr", meaning: "Quranic exegesis" },
  { ar: "أسباب النزول", translit: "asbāb al-nuzūl", meaning: "occasions of revelation" },
  { ar: "مكي", translit: "makkī", meaning: "revealed in Mecca" },
  { ar: "مدني", translit: "madanī", meaning: "revealed in Medina" },
]

const index = glossary.map((entry) => ({ entry, key: normalizeArabic(entry.ar) }))

/** Glossary entries whose term appears in the passage (diacritics ignored). */
export function relevantTerms(text: string, limit = 25): GlossaryEntry[] {
  const haystack = ` ${normalizeArabic(text)} `
  return index
    .filter(({ key }) => key.length > 2 && haystack.includes(key))
    .slice(0, limit)
    .map(({ entry }) => entry)
}
