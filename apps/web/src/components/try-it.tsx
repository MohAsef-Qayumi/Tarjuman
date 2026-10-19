"use client"

import { useState } from "react"
import { languages, type LanguageCode, type TranslateResult, type WordResult } from "@tarjuman/core"

const SAMPLE =
  "حَدَّثَنَا الحُمَيْدِيُّ عَبْدُ اللَّهِ بْنُ الزُّبَيْرِ، قَالَ: حَدَّثَنَا سُفْيَانُ، عَنْ يَحْيَى بْنِ سَعِيدٍ الأَنْصَارِيِّ، عَنْ عَلْقَمَةَ بْنِ وَقَّاصٍ اللَّيْثِيِّ، قَالَ: سَمِعْتُ عُمَرَ بْنَ الخَطَّابِ رَضِيَ اللَّهُ عَنْهُ عَلَى المِنْبَرِ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَقُولُ: «إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ»"

const targets = (Object.keys(languages) as LanguageCode[]).filter((code) => code !== "ar")

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

export function TryIt() {
  const [text, setText] = useState(SAMPLE)
  const [to, setTo] = useState<LanguageCode>("en")
  const [result, setResult] = useState<{ source: string; data: TranslateResult } | null>(null)
  const [word, setWord] = useState<{ word: string; data?: WordResult; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function translate() {
    setBusy(true)
    setError("")
    setWord(null)
    try {
      setResult({ source: text, data: await post<TranslateResult>("/api/translate", { text, from: "auto", to }) })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function lookup(token: string) {
    const clean = token.replace(/[^؀-ۿ]/g, "")
    if (!clean || !result) return
    setWord({ word: clean })
    try {
      setWord({ word: clean, data: await post<WordResult>("/api/word", { word: clean, context: result.source.slice(0, 600), to }) })
    } catch (err) {
      setWord({ word: clean, error: (err as Error).message })
    }
  }

  const dir = languages[to].dir

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-surface p-5">
        <label htmlFor="source" className="mb-2 block text-sm font-medium text-muted">
          Arabic text
        </label>
        <textarea
          id="source"
          dir="rtl"
          lang="ar"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          className="arabic h-56 w-full resize-y rounded-md border border-line bg-bg/50 p-3 focus:border-brand focus:outline-none"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted" htmlFor="target">
            Translate to
          </label>
          <select
            id="target"
            value={to}
            onChange={(e) => setTo(e.target.value as LanguageCode)}
            className="h-10 rounded-md border border-line bg-surface px-3 text-sm"
          >
            {targets.map((code) => (
              <option key={code} value={code}>
                {languages[code].name} — {languages[code].native}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void translate()}
            disabled={busy || !text.trim()}
            className="ms-auto h-10 rounded-md bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? "Translating…" : "Translate"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-5" aria-live="polite">
        {!result ? (
          <p className="text-sm text-muted">The translation appears here. Then click any Arabic word to see its root and meanings.</p>
        ) : (
          <>
            <p dir={dir} lang={to} className={dir === "rtl" ? "arabic" : "text-lg leading-relaxed"}>
              {result.data.translation}
            </p>
            {result.data.terms.length > 0 && (
              <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
                {result.data.terms.map((t) => (
                  <div key={t.term} className="flex flex-wrap gap-x-2">
                    <dt className="font-medium">
                      <span lang="ar">{t.term}</span>
                      {t.translit && <span className="ms-1 italic text-muted">{t.translit}</span>}
                    </dt>
                    <dd dir={dir} className="text-muted">
                      — {t.meaning}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Tap a word</p>
              <p dir="rtl" lang="ar" className="arabic">
                {result.source.split(/(\s+)/).map((token, i) =>
                  /\s/.test(token) ? (
                    token
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => void lookup(token)}
                      className={`rounded px-0.5 hover:bg-accent/10 ${word?.word && token.includes(word.word) ? "bg-accent/15" : ""}`}
                    >
                      {token}
                    </button>
                  ),
                )}
              </p>
            </div>

            {word && (
              <div className="mt-4 rounded-lg bg-bg p-4 text-sm">
                {word.error ? (
                  <p className="text-red-700">{word.error}</p>
                ) : !word.data ? (
                  <p className="text-muted">Looking up {word.word}…</p>
                ) : (
                  <>
                    <p className="arabic !text-2xl" dir="rtl">
                      {word.data.vocalized ?? word.data.word}
                    </p>
                    <p className="mt-1 text-muted">
                      {[word.data.root && `Root: ${word.data.root}`, word.data.lemma && `Lemma: ${word.data.lemma}`, word.data.partOfSpeech]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {word.data.inContext && (
                      <p dir={dir} className="mt-2 font-medium">
                        {word.data.inContext}
                      </p>
                    )}
                    <p dir={dir} className="mt-1 text-muted">
                      {word.data.meanings.join("، ")}
                    </p>
                  </>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">Machine translation{result.data.cached ? " · cached" : ""}. Always check religious rulings with a qualified scholar.</p>
          </>
        )}
      </div>
    </div>
  )
}
