# Tarjuman · تُرجمان

**Read classical Arabic in your language, right where you read it.**

[Shamela](https://shamela.ws) and similar libraries hold thousands of classical Islamic books, but students who are not fluent in Arabic struggle to use them, and general-purpose translators handle hadith, fiqh and usul terminology badly. Tarjuman adds a floating button to the page: select a passage (or click a paragraph), choose a language, and read a careful translation beside the original. Tap any Arabic word to see its root and meaning in context.

Languages: English, Dari, Pashto, Urdu, Turkish, Indonesian (and Arabic as a source).

## How it works

```
 Browser extension                         Web app (Next.js on Vercel)
┌────────────────────────────┐           ┌──────────────────────────────────┐
│ content script (shadow DOM)│  message  │ /api/translate   /api/word        │
│  floating button, picker,  ├──────────►│  validate → rate limit → cache    │
│  panel, word lookup        │ background│        │                         │
│                            │  worker   │        ▼                         │
│  device cache (storage)    │◄──────────┤  @tarjuman/core                  │
└────────────────────────────┘           │  prompts + glossary → provider   │
                                         │  chain (Gemini → Groq → …)       │
                                         └──────────────────────────────────┘
```

- **`packages/core`** — prompts written for classical texts, a glossary of ~50 technical terms (only the terms found in a passage are sent), Arabic normalisation, response validation, and a provider chain. Any OpenAI-compatible API works; if one provider is rate-limited, down, or returns malformed output, the next one is tried, so free tiers can be stacked.
- **`apps/web`** — the API and a “try it” page. Requests are validated, rate-limited per IP to protect the quota, and cached.
- **`apps/extension`** — a Manifest V3 extension. It appears automatically on Shamela and on any page that is mostly Arabic. All UI lives in a shadow root, so it neither breaks nor is broken by the host page. Results are cached on the device.

### Translation rules

The model is instructed to translate faithfully without commentary; keep Quran references and mark verse translations as *(meaning)*; transliterate names and isnad narrators; render honorifics conventionally; and use the glossary sense of technical terms, listing each one it translated. Output is validated against a schema before it reaches the reader.

> Machine translation can be wrong. Tarjuman always shows the original beside the translation, and religious rulings should be verified with a qualified scholar.

## Run it locally

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # add at least one free key (below)
npm run dev -w @tarjuman/web                   # http://localhost:3000
```

No key yet? Set `TARJUMAN_MOCK=1` in `.env.local` to get placeholder translations and try the whole flow.

### Free AI providers

Add one or more; they are tried in the order of `TRANSLATE_PROVIDERS`.

| Provider | Get a key | Variables |
| --- | --- | --- |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | `GROQ_API_KEY`, `GROQ_MODEL` |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` |

Choose a current model from each provider's model list. Free tiers have rate limits, and some providers may use free-tier requests to improve their models; check their terms.

## Browser extension

```bash
TARJUMAN_API=https://your-deployment.vercel.app npm run build -w @tarjuman/extension
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose `apps/extension/dist`. The server address can also be changed later from the extension's popup.

## Deploy

On Vercel, import the repository and set **Root Directory** to `apps/web`. Add the provider variables from the table above. Then build the extension with `TARJUMAN_API` set to the deployment URL.

## Tests

```bash
npm test                                         # unit tests (core, web, extension)
npm run build -w @tarjuman/web
npm run build:test -w @tarjuman/extension
npm run e2e -w @tarjuman/extension               # loads the extension into Chromium
```

The end-to-end test runs the API in mock mode, serves a Shamela-style page and drives the real extension: selection, paragraph picking, word lookup, language switching, device caching and visibility rules.

## Roadmap

- Desktop app (Windows/macOS) with an always-on-top bubble for the Shamela desktop program
- Android app with a “display over other apps” bubble; iOS share extension
- On-screen text recognition as a fallback when text can't be selected
- Translation quality evaluation set reviewed by native speakers
