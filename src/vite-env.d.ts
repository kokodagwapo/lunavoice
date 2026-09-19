/// <reference types="vite/client" />

export type LunaArtifact = {
  title: string;
  kind:
    | "text"
    | "markdown"
    | "code"
    | "table"
    | "notes"
    | "mermaid"
    | "image"
    | "imageLoading"
    | "thumbnailBoard"
    | "progress";
  content: string;
  language?: string;
  fullscreen?: boolean;
};

export type LunaToolSpec = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LunaToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type LunaToolResult = {
  ok: boolean;
  artifact?: LunaArtifact;
  mode?: "display" | "computer";
  message?: string;
  error?: string;
  [key: string]: unknown;
};

export type ElevenLabsRealtimeConfig = {
  provider: "elevenlabs";
  signedUrl: string;
  agentId: string;
};

export type LunaRealtimeConfig = ElevenLabsRealtimeConfig;

export type UploadedFile = {
  path: string;
  name: string;
};

export type ConnectorManifest = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authType: string;
  status: "available" | "stub" | "coming_soon";
  enabled: boolean;
  configured: boolean;
  tools: string[];
};

export type SecretInfo = {
  key: string;
  masked: string;
  source: "env" | "stored";
  encrypted: boolean;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  accent: string;
  icon: string;
  isDefault: boolean;
};

export type ConversationSummary = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "luna" | "system";
  text: string;
  timestamp: string;
};

export type Conversation = {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

declare global {
  interface Window {
    luna: {
      getRealtimeConfig: () => Promise<LunaRealtimeConfig>;
      executeTool: (toolCall: LunaToolCall) => Promise<LunaToolResult>;
      getToolSpecs: () => Promise<LunaToolSpec[]>;
      restart: () => Promise<void>;
      selectFiles: () => Promise<string[]>;
      uploadFile: (filePath: string) => Promise<UploadedFile>;
      listConnectors: () => Promise<ConnectorManifest[]>;
      enableConnector: (id: string) => Promise<{ ok: boolean }>;
      disableConnector: (id: string) => Promise<{ ok: boolean }>;
      getConnectorStatus: (id: string) => Promise<ConnectorManifest | null>;
      listSecrets: () => Promise<SecretInfo[]>;
      setSecret: (key: string, value: string) => Promise<{ ok: boolean }>;
      deleteSecret: (key: string) => Promise<{ ok: boolean }>;
      // Agent APIs
      listAgents: () => Promise<{ agents: Agent[]; activeAgentId: string }>;
      getActiveAgent: () => Promise<Agent>;
      setActiveAgent: (agentId: string) => Promise<{ ok: boolean; agent?: Agent }>;
      createAgent: (data: Partial<Agent>) => Promise<{ ok: boolean; agent?: Agent }>;
      updateAgent: (agentId: string, updates: Partial<Agent>) => Promise<{ ok: boolean; agent?: Agent }>;
      deleteAgent: (agentId: string) => Promise<{ ok: boolean; error?: string }>;
      // Conversation APIs
      listConversations: (agentId?: string) => Promise<ConversationSummary[]>;
      getConversation: (conversationId: string) => Promise<Conversation | null>;
      createConversation: (agentId: string, agentName: string) => Promise<Conversation>;
      addMessage: (conversationId: string, role: string, text: string) => Promise<ConversationMessage | null>;
      deleteConversation: (conversationId: string) => Promise<{ ok: boolean }>;
    };
  }
}
