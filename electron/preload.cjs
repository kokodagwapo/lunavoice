const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luna", {
  getRealtimeConfig: () => ipcRenderer.invoke("realtime:get-config"),
  executeTool: (toolCall) => ipcRenderer.invoke("tools:execute", toolCall),
  getToolSpecs: () => ipcRenderer.invoke("tools:list"),
  restart: () => ipcRenderer.invoke("app:restart"),
});
