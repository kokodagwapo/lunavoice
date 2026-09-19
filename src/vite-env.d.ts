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
    };
  }
}
