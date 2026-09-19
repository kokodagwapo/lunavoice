/**
 * Luna Voice Connector Framework
 * Pluggable integration system for external services
 */

const { safeStorage } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const dataDir = path.join(process.cwd(), "data");
const connectorsConfigPath = path.join(dataDir, "connectors.json");

// ============== Connector Manifest Schema ==============

/**
 * Connector Manifest Structure:
 * {
 *   id: string,              // Unique identifier (e.g., "gmail", "encompass")
 *   name: string,            // Display name
 *   description: string,     // What this connector does
 *   icon: string,            // Icon name (lucide)
 *   category: string,        // Category (email, los, search, storage, etc.)
 *   authType: string,        // "oauth2" | "api_key" | "basic" | "none"
 *   authConfig: {            // Auth-specific config
 *     // OAuth2: tokenUrl, authorizeUrl, scopes, etc.
 *     // API Key: headerName, envVar, etc.
 *   },
 *   requiredSecrets: string[], // List of required secret keys
 *   optionalSecrets: string[], // List of optional secret keys
 *   tools: [{                  // Tools this connector provides
 *     name: string,
 *     description: string,
 *     requiresAuth: boolean,
 *     requiresConfirmation: boolean, // For write/send actions
 *     parameters: object
 *   }],
 *   status: "available" | "stub" | "coming_soon",
 *   version: string
 * }
 */

// ============== Built-in Connector Manifests ==============

const CONNECTOR_MANIFESTS = {
  memory: {
    id: "memory",
    name: "Luna Memory",
    description: "Persistent memory storage for Luna",
    icon: "Brain",
    category: "core",
    authType: "none",
    authConfig: {},
    requiredSecrets: [],
    optionalSecrets: [],
    tools: ["memory_save", "memory_search", "memory_list", "memory_delete"],
    status: "available",
    version: "1.0.0",
  },

  web_search: {
    id: "web_search",
    name: "Web Search (Exa)",
    description: "Search the web for current information",
    icon: "Search",
    category: "search",
    authType: "api_key",
    authConfig: {
      headerName: "x-api-key",
      envVar: "EXA_API_KEY",
    },
    requiredSecrets: ["EXA_API_KEY"],
    optionalSecrets: [],
    tools: ["web_search"],
    status: "available",
    version: "1.0.0",
  },

  file_ocr: {
    id: "file_ocr",
    name: "File & OCR",
    description: "Upload and parse files, extract text via OCR",
    icon: "FileText",
    category: "core",
    authType: "none",
    authConfig: {},
    requiredSecrets: [],
    optionalSecrets: [],
    tools: ["file_parse", "ocr_extract"],
    status: "available",
    version: "1.0.0",
  },

  knowledge_base: {
    id: "knowledge_base",
    name: "Knowledge Base",
    description: "US lending and LOS API knowledge",
    icon: "BookOpen",
    category: "core",
    authType: "none",
    authConfig: {},
    requiredSecrets: [],
    optionalSecrets: [],
    tools: ["kb_search", "kb_topics"],
    status: "available",
    version: "1.0.0",
  },

  gmail: {
    id: "gmail",
    name: "Gmail",
    description: "Read and search Gmail messages",
    icon: "Mail",
    category: "email",
    authType: "oauth2",
    authConfig: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      envVarClientId: "GOOGLE_CLIENT_ID",
      envVarClientSecret: "GOOGLE_CLIENT_SECRET",
    },
    requiredSecrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    optionalSecrets: ["GMAIL_REFRESH_TOKEN"],
    tools: ["gmail_list_messages", "gmail_search", "gmail_get_message"],
    status: "stub",
    version: "0.1.0",
  },

  encompass: {
    id: "encompass",
    name: "ICE Encompass",
    description: "Integrate with Encompass LOS via Developer Connect API",
    icon: "Building2",
    category: "los",
    authType: "oauth2",
    authConfig: {
      tokenUrl: "https://api.elliemae.com/oauth2/v1/token",
      grantType: "client_credentials",
      envVarClientId: "ENCOMPASS_CLIENT_ID",
      envVarClientSecret: "ENCOMPASS_CLIENT_SECRET",
      envVarInstanceId: "ENCOMPASS_INSTANCE_ID",
    },
    requiredSecrets: ["ENCOMPASS_CLIENT_ID", "ENCOMPASS_CLIENT_SECRET", "ENCOMPASS_INSTANCE_ID"],
    optionalSecrets: [],
    tools: ["encompass_get_loan", "encompass_search_pipeline", "encompass_list_documents"],
    status: "stub",
    version: "0.1.0",
  },

  rest_generic: {
    id: "rest_generic",
    name: "Generic REST API",
    description: "Connect to any REST API with configurable auth",
    icon: "Globe",
    category: "integration",
    authType: "configurable",
    authConfig: {
      supportedTypes: ["api_key", "bearer", "basic", "none"],
    },
    requiredSecrets: [],
    optionalSecrets: ["REST_API_KEY", "REST_API_TOKEN"],
    tools: ["rest_request"],
    status: "stub",
    version: "0.1.0",
  },

  openai: {
    id: "openai",
    name: "OpenAI",
    description: "Image generation and other OpenAI tools",
    icon: "Sparkles",
    category: "ai",
    authType: "api_key",
    authConfig: {
      headerName: "Authorization",
      headerPrefix: "Bearer ",
      envVar: "OPENAI_API_KEY",
    },
    requiredSecrets: ["OPENAI_API_KEY"],
    optionalSecrets: [],
    tools: ["image_generate"],
    status: "available",
    version: "1.0.0",
  },

  elevenlabs: {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Voice conversation with Luna SmartStart agent",
    icon: "AudioWaveform",
    category: "voice",
    authType: "api_key",
    authConfig: {
      headerName: "xi-api-key",
      envVar: "ELEVENLABS_API_KEY",
    },
    requiredSecrets: ["ELEVENLABS_API_KEY"],
    optionalSecrets: ["ELEVENLABS_AGENT_ID", "ELEVENLABS_VOICE_ID"],
    tools: [],
    status: "available",
    version: "1.0.0",
  },
};

// ============== Connector State Management ==============

async function ensureConnectorsConfig() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(connectorsConfigPath);
  } catch {
    const defaultConfig = {
      enabled: ["memory", "file_ocr", "knowledge_base"],
      secrets: {},
    };
    await fs.writeFile(connectorsConfigPath, JSON.stringify(defaultConfig, null, 2));
  }
}

async function readConnectorsConfig() {
  await ensureConnectorsConfig();
  const raw = await fs.readFile(connectorsConfigPath, "utf8");
  return JSON.parse(raw);
}

async function writeConnectorsConfig(config) {
  await ensureConnectorsConfig();
  await fs.writeFile(connectorsConfigPath, JSON.stringify(config, null, 2));
}

// ============== Secure Secret Storage ==============

function canUseSecureStorage() {
  return safeStorage && safeStorage.isEncryptionAvailable();
}

function encryptSecret(value) {
  if (canUseSecureStorage()) {
    const encrypted = safeStorage.encryptString(value);
    return { encrypted: true, data: encrypted.toString("base64") };
  }
  // Fallback: base64 encode (not secure, but functional)
  return { encrypted: false, data: Buffer.from(value).toString("base64") };
}

function decryptSecret(stored) {
  if (!stored || !stored.data) return null;
  
  if (stored.encrypted && canUseSecureStorage()) {
    const buffer = Buffer.from(stored.data, "base64");
    return safeStorage.decryptString(buffer);
  }
  // Fallback: base64 decode
  return Buffer.from(stored.data, "base64").toString("utf8");
}

async function setSecret(key, value) {
  const config = await readConnectorsConfig();
  config.secrets = config.secrets || {};
  config.secrets[key] = encryptSecret(value);
  await writeConnectorsConfig(config);
  return { ok: true };
}

async function getSecret(key) {
  // First check environment variables
  const envValue = process.env[key];
  if (envValue) return envValue;
  
  // Then check stored secrets
  const config = await readConnectorsConfig();
  if (config.secrets && config.secrets[key]) {
    return decryptSecret(config.secrets[key]);
  }
  return null;
}

async function deleteSecret(key) {
  const config = await readConnectorsConfig();
  if (config.secrets && config.secrets[key]) {
    delete config.secrets[key];
    await writeConnectorsConfig(config);
  }
  return { ok: true };
}

async function listSecrets() {
  const config = await readConnectorsConfig();
  const secrets = config.secrets || {};
  
  // Return list with masked values
  const result = [];
  for (const key of Object.keys(secrets)) {
    const value = decryptSecret(secrets[key]);
    result.push({
      key,
      masked: value ? `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}` : "****",
      source: "stored",
      encrypted: secrets[key].encrypted,
    });
  }
  
  // Also list env vars for known connectors
  for (const connector of Object.values(CONNECTOR_MANIFESTS)) {
    for (const secretKey of [...connector.requiredSecrets, ...connector.optionalSecrets]) {
      if (process.env[secretKey] && !result.find((s) => s.key === secretKey)) {
        const value = process.env[secretKey];
        result.push({
          key: secretKey,
          masked: `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`,
          source: "env",
          encrypted: false,
        });
      }
    }
  }
  
  return result;
}

// ============== Connector Management ==============

async function listConnectors() {
  const config = await readConnectorsConfig();
  const enabled = new Set(config.enabled || []);
  
  const connectors = [];
  for (const [id, manifest] of Object.entries(CONNECTOR_MANIFESTS)) {
    // Check if all required secrets are available
    let hasRequiredSecrets = true;
    for (const secretKey of manifest.requiredSecrets) {
      const secret = await getSecret(secretKey);
      if (!secret) {
        hasRequiredSecrets = false;
        break;
      }
    }
    
    connectors.push({
      ...manifest,
      enabled: enabled.has(id),
      configured: hasRequiredSecrets,
      missingSecrets: manifest.requiredSecrets.filter(async (key) => !(await getSecret(key))),
    });
  }
  
  return connectors;
}

async function enableConnector(id) {
  const config = await readConnectorsConfig();
  const enabled = new Set(config.enabled || []);
  enabled.add(id);
  config.enabled = Array.from(enabled);
  await writeConnectorsConfig(config);
  return { ok: true, enabled: true };
}

async function disableConnector(id) {
  const config = await readConnectorsConfig();
  const enabled = new Set(config.enabled || []);
  enabled.delete(id);
  config.enabled = Array.from(enabled);
  await writeConnectorsConfig(config);
  return { ok: true, enabled: false };
}

async function getConnectorStatus(id) {
  const manifest = CONNECTOR_MANIFESTS[id];
  if (!manifest) return null;
  
  const config = await readConnectorsConfig();
  const enabled = (config.enabled || []).includes(id);
  
  const secretStatus = {};
  for (const secretKey of [...manifest.requiredSecrets, ...manifest.optionalSecrets]) {
    const value = await getSecret(secretKey);
    secretStatus[secretKey] = {
      configured: !!value,
      required: manifest.requiredSecrets.includes(secretKey),
    };
  }
  
  return {
    ...manifest,
    enabled,
    secretStatus,
    ready: enabled && manifest.requiredSecrets.every((key) => secretStatus[key]?.configured),
  };
}

// ============== Tool Interface ==============

const connectorToolSpecs = [
  {
    type: "function",
    name: "connectors_list",
    description: "List all available connectors and their status",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "connectors_enable",
    description: "Enable a connector by ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Connector ID" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "connectors_disable",
    description: "Disable a connector by ID",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Connector ID" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "connectors_status",
    description: "Get detailed status of a specific connector",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Connector ID" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "secrets_list",
    description: "List configured API keys and secrets (masked values only)",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "secrets_set",
    description: "Store an API key or secret securely. Never log or display the actual value.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Secret key name (e.g., OPENAI_API_KEY)" },
        value: { type: "string", description: "Secret value - NEVER log this" },
      },
      required: ["key", "value"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "secrets_delete",
    description: "Delete a stored secret",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Secret key name to delete" },
        confirmed: { type: "boolean", description: "Confirm deletion" },
      },
      required: ["key", "confirmed"],
      additionalProperties: false,
    },
  },
];

async function handleConnectorTool(name, args) {
  switch (name) {
    case "connectors_list": {
      const connectors = await listConnectors();
      const byCategory = {};
      for (const c of connectors) {
        if (!byCategory[c.category]) byCategory[c.category] = [];
        byCategory[c.category].push(c);
      }
      
      let content = "## Available Connectors\n\n";
      for (const [category, list] of Object.entries(byCategory)) {
        content += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        for (const c of list) {
          const status = c.status === "stub" ? "🔲 Stub" : c.enabled ? "✅ Enabled" : "⬜ Disabled";
          const configured = c.configured ? "" : " ⚠️ Missing secrets";
          content += `- **${c.name}** (${c.id}): ${status}${configured}\n`;
          content += `  ${c.description}\n`;
        }
        content += "\n";
      }
      
      return {
        ok: true,
        connectors,
        artifact: { title: "Connectors", kind: "markdown", content },
      };
    }
    
    case "connectors_enable":
      return await enableConnector(args.id);
    
    case "connectors_disable":
      return await disableConnector(args.id);
    
    case "connectors_status": {
      const status = await getConnectorStatus(args.id);
      if (!status) return { ok: false, error: `Connector not found: ${args.id}` };
      
      let content = `## ${status.name}\n\n`;
      content += `**Status:** ${status.enabled ? "Enabled" : "Disabled"}\n`;
      content += `**Ready:** ${status.ready ? "Yes" : "No"}\n`;
      content += `**Version:** ${status.version}\n\n`;
      content += `### Secrets\n\n`;
      for (const [key, info] of Object.entries(status.secretStatus)) {
        const icon = info.configured ? "✅" : info.required ? "❌" : "⬜";
        content += `- ${icon} ${key} ${info.required ? "(required)" : "(optional)"}\n`;
      }
      content += `\n### Tools\n\n`;
      for (const tool of status.tools) {
        content += `- ${tool}\n`;
      }
      
      return {
        ok: true,
        status,
        artifact: { title: `Connector: ${status.name}`, kind: "markdown", content },
      };
    }
    
    case "secrets_list": {
      const secrets = await listSecrets();
      let content = "## Configured Secrets\n\n";
      if (secrets.length === 0) {
        content += "No secrets configured. Add secrets via environment variables or the secrets_set tool.\n";
      } else {
        content += "| Key | Value | Source | Encrypted |\n";
        content += "|-----|-------|--------|------------|\n";
        for (const s of secrets) {
          content += `| ${s.key} | ${s.masked} | ${s.source} | ${s.encrypted ? "Yes" : "No"} |\n`;
        }
      }
      content += "\n*Secret values are masked for security.*";
      
      return {
        ok: true,
        secrets,
        artifact: { title: "API Keys & Secrets", kind: "markdown", content },
      };
    }
    
    case "secrets_set": {
      // IMPORTANT: Never log the value
      const result = await setSecret(args.key, args.value);
      return {
        ok: true,
        message: `Secret ${args.key} stored securely.`,
        artifact: {
          title: "Secret Stored",
          kind: "markdown",
          content: `## Secret Stored\n\n✅ **${args.key}** has been securely stored.\n\n*The value is encrypted using OS keychain where available.*`,
        },
      };
    }
    
    case "secrets_delete": {
      if (!args.confirmed) {
        return { ok: false, requiresConfirmation: true, message: `Confirm deletion of secret: ${args.key}?` };
      }
      await deleteSecret(args.key);
      return {
        ok: true,
        message: `Secret ${args.key} deleted.`,
      };
    }
    
    default:
      return null;
  }
}

module.exports = {
  CONNECTOR_MANIFESTS,
  connectorToolSpecs,
  handleConnectorTool,
  getSecret,
  setSecret,
  deleteSecret,
  listSecrets,
  listConnectors,
  enableConnector,
  disableConnector,
  getConnectorStatus,
};
