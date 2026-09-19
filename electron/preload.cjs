const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luna", {
  getRealtimeConfig: () => ipcRenderer.invoke("realtime:get-config"),
  executeTool: (toolCall) => ipcRenderer.invoke("tools:execute", toolCall),
  getToolSpecs: () => ipcRenderer.invoke("tools:list"),
  restart: () => ipcRenderer.invoke("app:restart"),
  selectFiles: () => ipcRenderer.invoke("file:select"),
  uploadFile: (filePath) => ipcRenderer.invoke("file:upload", filePath),
  // Connector APIs
  listConnectors: () => ipcRenderer.invoke("connectors:list"),
  enableConnector: (id) => ipcRenderer.invoke("connectors:enable", id),
  disableConnector: (id) => ipcRenderer.invoke("connectors:disable", id),
  getConnectorStatus: (id) => ipcRenderer.invoke("connectors:status", id),
  // Secrets APIs
  listSecrets: () => ipcRenderer.invoke("secrets:list"),
  setSecret: (key, value) => ipcRenderer.invoke("secrets:set", key, value),
  deleteSecret: (key) => ipcRenderer.invoke("secrets:delete", key),
});
