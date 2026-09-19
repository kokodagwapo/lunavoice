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

declare global {
  interface Window {
    luna: {
      getRealtimeConfig: () => Promise<LunaRealtimeConfig>;
      executeTool: (toolCall: LunaToolCall) => Promise<LunaToolResult>;
      getToolSpecs: () => Promise<LunaToolSpec[]>;
      restart: () => Promise<void>;
    };
  }
}
