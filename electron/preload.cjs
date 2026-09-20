const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("luna", {
  getRealtimeConfig: () => ipcRenderer.invoke("realtime:get-config"),
  executeTool: (toolCall) => ipcRenderer.invoke("tools:execute", toolCall),
  getToolSpecs: () => ipcRenderer.invoke("tools:list"),
  restart: () => ipcRenderer.invoke("app:restart"),
  selectFiles: () => ipcRenderer.invoke("file:select"),
  uploadFile: (filePath) => ipcRenderer.invoke("file:upload", filePath),
  // Mode APIs
  getMode: () => ipcRenderer.invoke("mode:get"),
  setMode: (mode) => ipcRenderer.invoke("mode:set", mode),
  // Connector APIs
  listConnectors: () => ipcRenderer.invoke("connectors:list"),
  enableConnector: (id) => ipcRenderer.invoke("connectors:enable", id),
  disableConnector: (id) => ipcRenderer.invoke("connectors:disable", id),
  getConnectorStatus: (id) => ipcRenderer.invoke("connectors:status", id),
  // Secrets APIs
  listSecrets: () => ipcRenderer.invoke("secrets:list"),
  setSecret: (key, value) => ipcRenderer.invoke("secrets:set", key, value),
  deleteSecret: (key) => ipcRenderer.invoke("secrets:delete", key),
  // Agent APIs
  listAgents: () => ipcRenderer.invoke("agents:list"),
  getActiveAgent: () => ipcRenderer.invoke("agents:get-active"),
  setActiveAgent: (agentId) => ipcRenderer.invoke("agents:set-active", agentId),
  createAgent: (agentData) => ipcRenderer.invoke("agents:create", agentData),
  updateAgent: (agentId, updates) => ipcRenderer.invoke("agents:update", agentId, updates),
  deleteAgent: (agentId) => ipcRenderer.invoke("agents:delete", agentId),
  // Conversation APIs
  listConversations: (agentId) => ipcRenderer.invoke("conversations:list", agentId),
  getConversation: (conversationId) => ipcRenderer.invoke("conversations:get", conversationId),
  createConversation: (agentId, agentName) => ipcRenderer.invoke("conversations:create", agentId, agentName),
  addMessage: (conversationId, role, text) => ipcRenderer.invoke("conversations:add-message", conversationId, role, text),
  deleteConversation: (conversationId) => ipcRenderer.invoke("conversations:delete", conversationId),
});
