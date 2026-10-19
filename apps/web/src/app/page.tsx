import { TryIt } from "@/components/try-it"

const features = [
  {
    title: "Built for classical texts",
    body: "A glossary of hadith, fiqh and usul terminology keeps technical words precise; Quran verses, isnad and names are handled by rule, not guesswork.",
  },
  {
    title: "Where you already read",
    body: "A floating button on shamela.ws and other sites: select a passage or click a paragraph, pick a language, read the translation beside the original.",
  },
  {
    title: "Learn as you go",
    body: "Tap any Arabic word for its root, pattern and meaning in context — so translation becomes a way to learn Arabic, not to avoid it.",
  },
]

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
      <header className="max-w-2xl">
        <p className="arabic text-brand">تُرجمان</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Read classical Arabic in your language.</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          Tarjuman translates passages from Islamic books — Shamela and beyond — into English, Dari, Pashto, Urdu, Turkish and Indonesian, right on the
          page you are reading.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <a href="#try" className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand/90">
            Try it
          </a>
          <a href="https://github.com/MohAsef-Qayumi/Tarjuman#browser-extension" className="rounded-md border border-line bg-surface px-5 py-2.5 font-medium hover:bg-bg">
            Get the browser extension
          </a>
        </div>
      </header>

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title}>
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="try" className="mt-20 scroll-mt-8">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Try it</h2>
        <TryIt />
      </section>

      <footer className="mt-20 border-t border-line pt-6 text-sm text-muted">
        Open source on{" "}
        <a className="underline underline-offset-4" href="https://github.com/MohAsef-Qayumi/Tarjuman">
          GitHub
        </a>
        .
      </footer>
    </main>
  )
}
