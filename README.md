# Tarjuman · تُرجمان

**Read classical Arabic in your language, right where you read it.**

[Shamela](https://shamela.ws) and similar libraries hold thousands of classical Islamic books, but readers who are not fluent in Arabic struggle to use them, and general-purpose translators handle hadith, fiqh and usul terminology poorly. Tarjuman puts a small **ت** button next to the text you are reading: select a passage, choose a language, and read a careful translation beside the original. Tap any Arabic word to see its root and meaning in context.

**Try it:** [tarjuman-xi.vercel.app](https://tarjuman-xi.vercel.app)

Translates into English, Dari, Pashto, Urdu, Turkish and Indonesian.

## Features

- **Built for classical texts** — a glossary of hadith, fiqh, usul and creed terminology keeps technical words precise; Quran verses, narrator chains, names and honorifics are handled by explicit rules.
- **Works where you read** — a browser extension for shamela.ws and any Arabic website, and a desktop app that floats over the Shamela program (or any other app).
- **Learn as you read** — tap a word for its root, pattern and meaning in context.
- **Original always visible** — the translation is shown beside the source text and clearly marked as machine translation.
- **Fast and frugal** — results are cached on the device and on the server; repeated passages never call a model twice.

> Machine translation can be wrong. Always verify religious rulings with a qualified scholar.

## Install

Download the latest version from **[Releases](https://github.com/MohAsef-Qayumi/Tarjuman/releases)**.

| Platform | File | How to install |
| --- | --- | --- |
| Chrome, Edge, Brave | `tarjuman-extension.zip` | Unzip, open `chrome://extensions`, enable *Developer mode*, click *Load unpacked* and choose the folder. |
| Windows | `Tarjuman-Setup-x.y.z.exe` | Run the installer. Builds are not yet code-signed, so SmartScreen may ask you to confirm (*More info → Run anyway*). |
| macOS | `Tarjuman-x.y.z.dmg` | Open and drag to Applications, then allow Tarjuman under *System Settings → Privacy & Security → Accessibility*. |
| Linux | `Tarjuman-x.y.z.AppImage` | Make it executable and run it. |

### Using the desktop app

1. Select Arabic text in Shamela or any other program.
2. Click the floating **ت** bubble, or press **Ctrl+Shift+Y** from anywhere.
3. The translation opens beside the bubble.

The bubble never takes keyboard focus, so your selection stays intact. To read it, Tarjuman briefly copies the selection and then restores whatever was on your clipboard before. The tray icon holds the language menu, *Start with Windows* and the settings file.

## How it works

```
 Browser extension ─┐                      Server (Next.js)
                    │   /api/translate    ┌──────────────────────────────┐
 Desktop app ───────┼────────────────────►│ validate → rate limit → cache │
                    │   /api/word         │            │                  │
 Website ───────────┘                     │  prompts + glossary            │
                                          │            ▼                  │
                                          │  provider chain with failover │
                                          │  (Gemini → Groq → OpenRouter) │
                                          └──────────────────────────────┘
```

Clients never hold API keys; they call the server, which owns the prompts, glossary and model providers.

**Translation.** Each request sends the model a prompt written for classical texts plus only the glossary entries that occur in the passage. The reply must be JSON matching a schema (translation, detected language, technical terms used) and is rejected otherwise.

**Failover.** Providers are tried in order, and each may list several keys and models. A provider that fails is put on a cooldown — as long as its `Retry-After` header asks, otherwise a minute for rate limits, 30 seconds for overload or timeouts, and 10 minutes for a bad key or model — so later requests go straight to one that works. `GET /api/health` reports the state of each provider without exposing keys.

**Reading the selection.** The extension renders inside a shadow root so it neither breaks nor is broken by the host page, and offers a paragraph picker when nothing is selected. The desktop app reads the selection of whichever program has focus: the PRIMARY selection on Linux, and a clipboard round-trip that restores the original contents on Windows and macOS.

## Project structure

| Path | Purpose |
| --- | --- |
| `packages/core` | Prompts, glossary, Arabic normalisation, schemas, provider chain with cooldowns |
| `packages/panel` | Translation panel UI shared by the extension and the desktop app |
| `apps/web` | API routes and the website |
| `apps/extension` | Manifest V3 browser extension |
| `apps/desktop` | Electron app: floating bubble, global shortcut, tray |

## Development

Requires Node.js 22.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev -w @tarjuman/web          # http://localhost:3000
npm run start -w @tarjuman/desktop    # desktop app
npm run dev -w @tarjuman/extension    # rebuilds apps/extension/dist on change
```

Set `TARJUMAN_MOCK=1` in `.env.local` to work without any API key; the server then returns placeholder translations. Point the extension and desktop app at a local server with `TARJUMAN_API=http://localhost:3000`.

### Tests

```bash
npm test                                          # unit tests in every package
npm run build -w @tarjuman/web                    # required by the end-to-end tests
npm run build:test -w @tarjuman/extension && npm run e2e -w @tarjuman/extension
npm run build -w @tarjuman/desktop && xvfb-run -a npm run e2e -w @tarjuman/desktop
```

The end-to-end suites run the server in mock mode and drive the real extension in Chromium and the real desktop app in Electron: selection, paragraph picking, word lookup, language switching, caching and persistence.

## Self-hosting

The server is a standard Next.js app in `apps/web` and runs on any Node host; on Vercel, set the project's root directory to `apps/web`.

Configure at least one OpenAI-compatible provider. Each has a free tier.

| Variable | Description |
| --- | --- |
| `TRANSLATE_PROVIDERS` | Order to try providers in. Default `gemini,groq,openrouter` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY`, `GROQ_MODEL` | [Groq](https://console.groq.com/keys) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | [OpenRouter](https://openrouter.ai/keys) |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute per client IP. Default `20` |

Keys and models accept comma-separated lists, e.g. `GEMINI_MODEL=preferred-model,backup-model`. Free tiers have rate limits, and some providers may use free-tier traffic to improve their models; check their terms.

To point the clients at your own server, build them with `TARJUMAN_API=https://your-server`, or change the address in the extension popup or the desktop settings file.

## Roadmap

- Android: a "Translate with Tarjuman" entry in the text-selection menu, and a floating bubble
- iOS: share-sheet extension
- Text recognition for pages where text can't be selected
- An evaluation set of passages reviewed by native speakers to measure translation quality
