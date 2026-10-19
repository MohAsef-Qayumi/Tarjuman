/** Styles for the translation panel, shared by the browser extension and the desktop app. */
export const panelStyles = `
* { box-sizing: border-box; }
.root {
  --brand: #14532d; --fg: #1c1917; --muted: #78716c; --line: #e7e2d8; --bg: #faf8f3; --accent: #b45309;
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg);
  /* Host pages (Shamela) are RTL; keep our chrome LTR and set direction per text block. */
  direction: ltr; text-align: start;
}
.ar { font-family: "Amiri", "Traditional Arabic", "Scheherazade New", serif; font-size: 20px; line-height: 2; }

.panel {
  position: fixed; z-index: 2147483647; right: 16px; bottom: 80px; width: min(440px, calc(100vw - 32px));
  max-height: min(70vh, 640px); display: flex; flex-direction: column;
  background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.2);
}
.panel.docked {
  position: static; width: 100%; height: 100vh; max-height: none; border: none; border-radius: 0; box-shadow: none;
}
@media (max-width: 520px) {
  .panel:not(.docked) { right: 0; left: 0; bottom: 0; width: 100%; max-height: 75vh; border-radius: 16px 16px 0 0; }
}
.head { display: flex; gap: 6px; align-items: center; padding: 10px 12px; border-bottom: 1px solid var(--line); }
.head strong { margin-inline-end: auto; color: var(--brand); }
.docked .head { -webkit-app-region: drag; }
.docked .head select, .docked .head button { -webkit-app-region: no-drag; }
select { height: 30px; border: 1px solid var(--line); border-radius: 6px; background: #fff; font-size: 13px; padding: 0 6px; color: var(--fg); }
.icon { border: none; background: none; cursor: pointer; font-size: 18px; color: var(--muted); padding: 2px 6px; border-radius: 6px; }
.icon:hover { background: var(--bg); color: var(--fg); }
.body { overflow: auto; padding: 14px 16px; flex: 1; }
.status { color: var(--muted); }
.error { color: #b91c1c; }
.translation { font-size: 16px; line-height: 1.7; white-space: pre-wrap; margin: 0; }
.translation.rtl { font-family: "Vazirmatn", "Noto Naskh Arabic", serif; font-size: 18px; line-height: 2; }
.terms { margin: 14px 0 0; padding: 12px 0 0; border-top: 1px solid var(--line); font-size: 13px; }
.terms div { margin: 3px 0; }
.terms dt { display: inline; font-weight: 600; }
.terms dd { display: inline; margin: 0; color: var(--muted); }
.label { margin: 16px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.original { white-space: pre-wrap; margin: 0; }
.word { cursor: pointer; border-radius: 3px; padding: 0 1px; }
.word:hover, .word.active { background: rgba(180,83,9,.15); }
.wordinfo { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--bg); font-size: 13px; }
.foot { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
.foot button { margin-inline-start: auto; border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
`
