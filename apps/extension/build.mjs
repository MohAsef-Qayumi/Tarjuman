import { build, context } from "esbuild"
import { cp, mkdir, rm } from "node:fs/promises"

const watch = process.argv.includes("--watch")
const outdir = "dist"
// Defaults to the production server; override with TARJUMAN_API=http://localhost:3000 for local development.
const api = process.env.TARJUMAN_API ?? "https://tarjuman-xi.vercel.app"

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
