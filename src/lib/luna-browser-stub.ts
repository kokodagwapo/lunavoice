/**
 * Browser stub for Luna API
 * Provides mock implementations when running outside of Electron
 * (e.g., in a browser for PWA/mobile or during development)
 */

import type {
  LunaRealtimeConfig,
  LunaToolCall,
  LunaToolResult,
  LunaToolSpec,
  UploadedFile,
  ConnectorManifest,
  SecretInfo,
  Agent,
  ConversationSummary,
  Conversation,
  ConversationMessage,
} from "../vite-env";

const DEFAULT_AGENT: Agent = {
  id: "luna-default",
  name: "Luna",
  role: "General Assistant",
  description: "Your AI voice assistant",
  systemPrompt: "",
  accent: "#6366f1",
  icon: "sparkles",
  isDefault: true,
};

const stubConversations: Map<string, Conversation> = new Map();

export const lunaBrowserStub: typeof window.luna = {
  getRealtimeConfig: async (): Promise<LunaRealtimeConfig> => {
    throw new Error("Voice requires Electron. Install the desktop app for voice features.");
  },

  executeTool: async (toolCall: LunaToolCall): Promise<LunaToolResult> => {
    console.log("[Browser Stub] executeTool:", toolCall.name);
    return {
      ok: false,
      error: `Tool execution requires Electron. Tool: ${toolCall.name}`,
    };
  },

  getToolSpecs: async (): Promise<LunaToolSpec[]> => {
    return [];
  },

  restart: async (): Promise<void> => {
    window.location.reload();
  },

  selectFiles: async (): Promise<string[]> => {
    console.log("[Browser Stub] selectFiles - not available in browser");
    return [];
  },

  uploadFile: async (filePath: string): Promise<UploadedFile> => {
    console.log("[Browser Stub] uploadFile:", filePath);
    return { path: filePath, name: filePath.split("/").pop() || "file" };
  },

  listConnectors: async (): Promise<ConnectorManifest[]> => {
    return [];
  },

  enableConnector: async (_id: string): Promise<{ ok: boolean }> => {
    return { ok: false };
  },

  disableConnector: async (_id: string): Promise<{ ok: boolean }> => {
    return { ok: false };
  },

  getConnectorStatus: async (_id: string): Promise<ConnectorManifest | null> => {
    return null;
  },

  listSecrets: async (): Promise<SecretInfo[]> => {
    return [];
  },

  setSecret: async (_key: string, _value: string): Promise<{ ok: boolean }> => {
    return { ok: false };
  },

  deleteSecret: async (_key: string): Promise<{ ok: boolean }> => {
    return { ok: false };
  },

  listAgents: async (): Promise<{ agents: Agent[]; activeAgentId: string }> => {
    return { agents: [DEFAULT_AGENT], activeAgentId: DEFAULT_AGENT.id };
  },

  getActiveAgent: async (): Promise<Agent> => {
    return DEFAULT_AGENT;
  },

  setActiveAgent: async (_agentId: string): Promise<{ ok: boolean; agent?: Agent }> => {
    return { ok: true, agent: DEFAULT_AGENT };
  },

  createAgent: async (data: Partial<Agent>): Promise<{ ok: boolean; agent?: Agent }> => {
    const agent: Agent = {
      id: crypto.randomUUID(),
      name: data.name || "New Agent",
      role: data.role || "Assistant",
      description: data.description || "",
      systemPrompt: data.systemPrompt || "",
      accent: data.accent || "#6366f1",
      icon: data.icon || "user",
      isDefault: false,
    };
    return { ok: true, agent };
  },

  updateAgent: async (_agentId: string, updates: Partial<Agent>): Promise<{ ok: boolean; agent?: Agent }> => {
    return { ok: true, agent: { ...DEFAULT_AGENT, ...updates } };
  },

  deleteAgent: async (_agentId: string): Promise<{ ok: boolean; error?: string }> => {
    return { ok: false, error: "Cannot delete agents in browser mode" };
  },

  listConversations: async (_agentId?: string): Promise<ConversationSummary[]> => {
    return Array.from(stubConversations.values()).map((c) => ({
      id: c.id,
      title: c.title,
      agentId: c.agentId,
      agentName: c.agentName,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }));
  },

  getConversation: async (conversationId: string): Promise<Conversation | null> => {
    return stubConversations.get(conversationId) || null;
  },

  createConversation: async (agentId: string, agentName: string): Promise<Conversation> => {
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      title: "New Chat",
      agentId,
      agentName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    stubConversations.set(conversation.id, conversation);
    return conversation;
  },

  addMessage: async (conversationId: string, role: string, text: string): Promise<ConversationMessage | null> => {
    const conversation = stubConversations.get(conversationId);
    if (!conversation) return null;
    
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      role: role as "user" | "luna" | "system",
      text,
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();
    if (conversation.messages.length === 1) {
      conversation.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
    }
    return message;
  },

  deleteConversation: async (conversationId: string): Promise<{ ok: boolean }> => {
    stubConversations.delete(conversationId);
    return { ok: true };
  },
};

/**
 * Initialize the Luna API - use Electron's window.luna if available,
 * otherwise fall back to the browser stub
 */
export function initLunaAPI(): void {
  if (typeof window !== "undefined" && !window.luna) {
    window.luna = lunaBrowserStub;
    console.log("[Luna] Running in browser mode with stub API");
  }
}
