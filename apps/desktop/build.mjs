import { build } from "esbuild"
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import { panelStyles } from "@tarjuman/panel/styles"

const outdir = "dist"
await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })
await cp("static", outdir, { recursive: true })
await writeFile(`${outdir}/panel.css`, panelStyles)

const common = { bundle: true, minify: true, target: "es2022", logLevel: "info" }

await Promise.all([
  build({ ...common, entryPoints: { main: "src/main/main.ts" }, outdir, platform: "node", format: "cjs", external: ["electron"] }),
  build({
    ...common,
    entryPoints: { "preload-bubble": "src/preload/bubble.ts", "preload-panel": "src/preload/panel.ts" },
    outdir,
    platform: "node",
    format: "cjs",
    external: ["electron"],
  }),
  build({ ...common, entryPoints: { bubble: "src/renderer/bubble.ts", panel: "src/renderer/panel.ts" }, outdir, platform: "browser", format: "iife" }),
])
