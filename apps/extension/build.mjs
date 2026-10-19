import { build, context } from "esbuild"
import { cp, mkdir, rm } from "node:fs/promises"

const watch = process.argv.includes("--watch")
const outdir = "dist"
// Point the extension at your deployed server: TARJUMAN_API=https://your-app.vercel.app npm run build
const api = process.env.TARJUMAN_API ?? "http://localhost:3000"

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })
await cp("static", outdir, { recursive: true })

const options = {
  entryPoints: { background: "src/background.ts", content: "src/content.ts", popup: "src/popup.ts" },
  outdir,
  bundle: true,
  format: "esm",
  target: "chrome110",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  define: { __DEFAULT_API__: JSON.stringify(api) },
  logLevel: "info",
}

if (watch) {
  await (await context(options)).watch()
} else {
  await build(options)
}
