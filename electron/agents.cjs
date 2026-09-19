/**
 * Luna Voice Multi-Agent System
 * Agent management and conversation persistence
 */

const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const dataDir = path.join(process.cwd(), "data");
const agentsPath = path.join(dataDir, "agents.json");
const conversationsDir = path.join(dataDir, "conversations");

// Default agents seeded on first run
const DEFAULT_AGENTS = [
  {
    id: "luna-default",
    name: "Luna",
    role: "General Assistant",
    description: "Friendly, knowledgeable AI assistant for mortgage and lending",
    systemPrompt: "You are Luna, a warm and knowledgeable AI assistant specializing in mortgage lending and financial guidance. Be helpful, accurate, and conversational.",
    accent: "#3B82F6", // blue
    icon: "sparkles",
    isDefault: true,
  },
  {
    id: "lending-analyst",
    name: "Alex",
    role: "Lending Analyst",
    description: "Deep expertise in loan analysis, underwriting, and risk assessment",
    systemPrompt: "You are Alex, a senior lending analyst. Focus on loan qualification, DTI ratios, credit analysis, and underwriting guidelines. Be precise and data-driven.",
    accent: "#8B5CF6", // purple
    icon: "calculator",
    isDefault: false,
  },
  {
    id: "compliance-officer",
    name: "Morgan",
    role: "Compliance Officer",
    description: "Expert in CFPB, HMDA, fair lending, and regulatory compliance",
    systemPrompt: "You are Morgan, a compliance officer. Focus on regulatory requirements, CFPB guidelines, HMDA reporting, fair lending, and audit preparation. Be thorough and cite regulations.",
    accent: "#059669", // emerald
    icon: "shield",
    isDefault: false,
  },
  {
    id: "marketing-strategist",
    name: "Jordan",
    role: "Marketing Strategist",
    description: "Specializes in lender marketing, lead generation, and brand strategy",
    systemPrompt: "You are Jordan, a mortgage marketing strategist. Focus on lead generation, digital marketing, brand positioning, and growth strategies for lenders.",
    accent: "#EC4899", // pink
    icon: "megaphone",
    isDefault: false,
  },
  {
    id: "pipeline-manager",
    name: "Casey",
    role: "Pipeline Manager",
    description: "Expert in loan pipeline management, operations, and workflow optimization",
    systemPrompt: "You are Casey, a pipeline operations manager. Focus on loan pipeline management, workflow optimization, cycle times, and operational efficiency.",
    accent: "#F59E0B", // amber
    icon: "activity",
    isDefault: false,
  },
  {
    id: "negotiation-coach",
    name: "Riley",
    role: "Negotiation Coach",
    description: "Helps with rate negotiations, objection handling, and closing strategies",
    systemPrompt: "You are Riley, a negotiation coach. Help with rate justifications, handling borrower objections, competitor comparisons, and closing strategies. Be persuasive but ethical.",
    accent: "#EF4444", // red
    icon: "handshake",
    isDefault: false,
  },
];

// ============== Agent Management ==============

async function ensureAgentsFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(agentsPath);
  } catch {
    await fs.writeFile(agentsPath, JSON.stringify({
      agents: DEFAULT_AGENTS,
      activeAgentId: "luna-default",
    }, null, 2));
  }
}

async function readAgentsData() {
  await ensureAgentsFile();
  const raw = await fs.readFile(agentsPath, "utf8");
  return JSON.parse(raw);
}

async function writeAgentsData(data) {
  await ensureAgentsFile();
  await fs.writeFile(agentsPath, JSON.stringify(data, null, 2));
}

async function listAgents() {
  const data = await readAgentsData();
  return {
    agents: data.agents,
    activeAgentId: data.activeAgentId,
  };
}

async function getActiveAgent() {
  const data = await readAgentsData();
  const agent = data.agents.find(a => a.id === data.activeAgentId) || data.agents[0];
  return agent;
}

async function setActiveAgent(agentId) {
  const data = await readAgentsData();
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent) return { ok: false, error: "Agent not found" };
  data.activeAgentId = agentId;
  await writeAgentsData(data);
  return { ok: true, agent };
}

async function createAgent({ name, role, description, systemPrompt, accent, icon }) {
  const data = await readAgentsData();
  const id = `agent-${crypto.randomUUID().slice(0, 8)}`;
  const agent = {
    id,
    name,
    role,
    description: description || "",
    systemPrompt: systemPrompt || `You are ${name}, a ${role}. Be helpful and knowledgeable in your area of expertise.`,
    accent: accent || "#6B7280",
    icon: icon || "user",
    isDefault: false,
  };
  data.agents.push(agent);
  await writeAgentsData(data);
  return { ok: true, agent };
}

async function updateAgent(agentId, updates) {
  const data = await readAgentsData();
  const index = data.agents.findIndex(a => a.id === agentId);
  if (index === -1) return { ok: false, error: "Agent not found" };
  if (data.agents[index].isDefault && updates.systemPrompt) {
    // Allow updating default agent's prompt
  }
  data.agents[index] = { ...data.agents[index], ...updates };
  await writeAgentsData(data);
  return { ok: true, agent: data.agents[index] };
}

async function deleteAgent(agentId) {
  const data = await readAgentsData();
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent) return { ok: false, error: "Agent not found" };
  if (agent.isDefault) return { ok: false, error: "Cannot delete default agent" };
  data.agents = data.agents.filter(a => a.id !== agentId);
  if (data.activeAgentId === agentId) {
    data.activeAgentId = "luna-default";
  }
  await writeAgentsData(data);
  return { ok: true };
}

// ============== Conversation Management ==============

async function ensureConversationsDir() {
  await fs.mkdir(conversationsDir, { recursive: true });
}

async function listConversations(agentId = null) {
  await ensureConversationsDir();
  const files = await fs.readdir(conversationsDir);
  const conversations = [];
  
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(conversationsDir, file), "utf8");
      const conv = JSON.parse(raw);
      if (agentId && conv.agentId !== agentId) continue;
      conversations.push({
        id: conv.id,
        title: conv.title,
        agentId: conv.agentId,
        agentName: conv.agentName,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages?.length || 0,
      });
    } catch {
      // Skip invalid files
    }
  }
  
  // Sort newest first
  conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return conversations;
}

async function getConversation(conversationId) {
  await ensureConversationsDir();
  const filePath = path.join(conversationsDir, `${conversationId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function createConversation(agentId, agentName) {
  await ensureConversationsDir();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const conversation = {
    id,
    title: "New Chat",
    agentId,
    agentName,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await fs.writeFile(
    path.join(conversationsDir, `${id}.json`),
    JSON.stringify(conversation, null, 2)
  );
  return conversation;
}

async function addMessage(conversationId, role, text) {
  const conversation = await getConversation(conversationId);
  if (!conversation) return null;
  
  const message = {
    id: crypto.randomUUID(),
    role,
    text,
    timestamp: new Date().toISOString(),
  };
  conversation.messages.push(message);
  conversation.updatedAt = message.timestamp;
  
  // Auto-generate title from first user message
  if (conversation.title === "New Chat" && role === "user") {
    conversation.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
  }
  
  await fs.writeFile(
    path.join(conversationsDir, `${conversationId}.json`),
    JSON.stringify(conversation, null, 2)
  );
  return message;
}

async function deleteConversation(conversationId) {
  const filePath = path.join(conversationsDir, `${conversationId}.json`);
  try {
    await fs.unlink(filePath);
    return { ok: true };
  } catch {
    return { ok: false, error: "Conversation not found" };
  }
}

module.exports = {
  listAgents,
  getActiveAgent,
  setActiveAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  listConversations,
  getConversation,
  createConversation,
  addMessage,
  deleteConversation,
};
