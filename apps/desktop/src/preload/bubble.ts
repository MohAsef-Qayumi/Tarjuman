import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("bubble", {
  click: () => ipcRenderer.send("bubble:click"),
  dragStart: () => ipcRenderer.send("bubble:drag-start"),
  drag: (dx: number, dy: number) => ipcRenderer.send("bubble:drag", dx, dy),
  dragEnd: () => ipcRenderer.send("bubble:drag-end"),
})
