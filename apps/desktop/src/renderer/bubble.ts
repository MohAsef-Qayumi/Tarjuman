const DRAG_THRESHOLD = 4
const button = document.getElementById("bubble") as HTMLButtonElement
let start: { x: number; y: number } | null = null
let dragging = false

button.addEventListener("pointerdown", (e) => {
  button.setPointerCapture(e.pointerId)
  start = { x: e.screenX, y: e.screenY }
  dragging = false
})

button.addEventListener("pointermove", (e) => {
  if (!start) return
  const dx = e.screenX - start.x
  const dy = e.screenY - start.y
  if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  if (!dragging) window.bubble.dragStart()
  dragging = true
  window.bubble.drag(dx, dy)
})

button.addEventListener("pointerup", () => {
  if (!start) return
  start = null
  if (dragging) window.bubble.dragEnd()
  else window.bubble.click()
})
