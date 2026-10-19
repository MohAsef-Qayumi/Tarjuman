import { panelStyles } from "@tarjuman/panel"

export const styles = `
:host { all: initial; }
${panelStyles}
.fab {
  position: fixed; z-index: 2147483646; width: 48px; height: 48px; border-radius: 50%;
  border: none; background: var(--brand); color: #fff; cursor: pointer; touch-action: none;
  box-shadow: 0 6px 20px rgba(0,0,0,.22); display: grid; place-items: center;
  font: 700 22px/1 "Amiri", serif; user-select: none; -webkit-user-select: none;
}
.fab:hover { filter: brightness(1.1); }
.fab[aria-pressed="true"] { background: var(--accent); }

.hint {
  position: fixed; z-index: 2147483646; left: 50%; top: 16px; transform: translateX(-50%);
  background: var(--fg); color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px;
  box-shadow: 0 6px 20px rgba(0,0,0,.2);
}
.highlight {
  position: fixed; z-index: 2147483645; pointer-events: none; border-radius: 4px;
  outline: 2px solid var(--accent); background: rgba(180,83,9,.08); transition: all .08s ease-out;
}
`
