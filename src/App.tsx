import { useRef, useState, useCallback, useEffect } from "react";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Plus, Settings, Bell, User, Trash2,
  PanelRight, RotateCcw, X, Search,
  MessageSquare, ChevronRight, Brain, Plug,
  Paperclip, Sparkles, Shield, Calculator, Megaphone,
  Activity, Handshake, UserPlus, Check
} from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { LunaFace } from "./components/LunaFace";
import { SettingsPanel } from "./components/SettingsPanel";
import { HoloDemo } from "./components/HoloDemo";
import { HoloDataCards, parseResponseToCards, type HoloCard } from "./components/HoloDataCards";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact, UploadedFile, Agent, ConversationSummary } from "./vite-env";

type LeftTab = "chats" | "agents" | "memory" | "connectors";

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles,
  calculator: Calculator,
  shield: Shield,
  megaphone: Megaphone,
  activity: Activity,
  handshake: Handshake,
  user: User,
};

function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = AGENT_ICONS[icon] || User;
  return <Icon size={16} className={className} />;
}

export default function App() {
  const [connectionState, setConnectionState] = useState<LunaConnectionState>("idle");
  const [mood, setMood] = useState<LunaMood>("idle");
  const [artifact, setArtifact] = useState<LunaArtifact | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [mouthShape, setMouthShape] = useState<MouthShape>({ open: 0, width: 0.18, round: 0, teeth: 0 });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [textPrompt, setTextPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<LeftTab>("chats");
  const [showSettings, setShowSettings] = useState(false);
  const [showHoloDemo, setShowHoloDemo] = useState(false);
  const [holoCards, setHoloCards] = useState<HoloCard[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Agent state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("");
  
  // Conversation state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  const clientRef = useRef<LunaRealtimeClient | null>(null);

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  // Load agents and conversations on mount
  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (activeAgent) {
      loadConversations();
    }
  }, [activeAgent?.id]);

  async function loadAgents() {
    try {
      const data = await window.luna.listAgents();
      setAgents(data.agents);
      const active = data.agents.find(a => a.id === data.activeAgentId) || data.agents[0];
      setActiveAgent(active);
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  }

  async function loadConversations() {
    try {
      const convs = await window.luna.listConversations(activeAgent?.id);
      setConversations(convs);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }

  async function switchAgent(agentId: string) {
    try {
      const result = await window.luna.setActiveAgent(agentId);
      if (result.ok && result.agent) {
        setActiveAgent(result.agent);
        setTranscript([]);
        setActiveConversationId(null);
      }
    } catch (error) {
      console.error("Failed to switch agent:", error);
    }
  }

  async function createNewAgent() {
    if (!newAgentName.trim() || !newAgentRole.trim()) return;
    try {
      const result = await window.luna.createAgent({
        name: newAgentName.trim(),
        role: newAgentRole.trim(),
      });
      if (result.ok) {
        await loadAgents();
        setShowNewAgent(false);
        setNewAgentName("");
        setNewAgentRole("");
      }
    } catch (error) {
      console.error("Failed to create agent:", error);
    }
  }

  async function startNewChat() {
    if (!activeAgent) return;
    try {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id);
      setTranscript([]);
      await loadConversations();
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  }

  async function switchConversation(convId: string) {
    try {
      const conv = await window.luna.getConversation(convId);
      if (conv) {
        setActiveConversationId(conv.id);
        setTranscript(conv.messages.map(m => ({
          id: m.id,
          role: m.role as TranscriptEntry["role"],
          text: m.text,
          at: new Date(m.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        })).reverse());
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  }

  async function deleteConv(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await window.luna.deleteConversation(convId);
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setTranscript([]);
      }
      await loadConversations();
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  }

  const addHoloCards = useCallback((cards: HoloCard[]) => {
    if (cards.length > 0) {
      setHoloCards(prev => [...prev, ...cards]);
    }
  }, []);

  async function connect() {
    const client = new LunaRealtimeClient({
      onConnectionState: setConnectionState,
      onMood: setMood,
      onMouthShape: setMouthShape,
      onTranscript: async (entry) => {
        setTranscript((items) => [entry, ...items].slice(0, 80));
        // Persist to conversation
        if (activeConversationId && (entry.role === "user" || entry.role === "luna")) {
          await window.luna.addMessage(activeConversationId, entry.role, entry.text);
        }
      },
      onArtifact: (nextArtifact) => {
        setArtifact(nextArtifact);
        setShowRightPanel(true);
        if (nextArtifact?.content) {
          const cards = parseResponseToCards(nextArtifact.content, nextArtifact.kind);
          addHoloCards(cards);
        }
      },
      onMode: () => {},
      onStatus: (message) => setTranscript((items) => [newEntry("system", message), ...items].slice(0, 80)),
      onThumbnailReady: () => {},
    });
    clientRef.current = client;
    
    // Start a conversation if none active
    if (!activeConversationId && activeAgent) {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id);
      await loadConversations();
    }
    
    await client.connect();
  }

  function disconnect() {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }

  async function handleRestart() {
    if (isConnected && !window.confirm("A call is active. Restart anyway?")) return;
    disconnect();
    await window.luna.restart();
  }

  async function sendTextPrompt() {
    const trimmed = textPrompt.trim();
    if (!trimmed) return;
    
    // Start conversation if needed
    if (!activeConversationId && activeAgent) {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id);
      await loadConversations();
    }
    
    if (clientRef.current) {
      clientRef.current.sendText(trimmed);
    } else {
      // Not connected - just add to transcript
      const entry = newEntry("user", trimmed);
      setTranscript((items) => [entry, ...items].slice(0, 80));
      if (activeConversationId) {
        await window.luna.addMessage(activeConversationId, "user", trimmed);
      }
    }
    setTextPrompt("");
  }

  async function handleFileUpload() {
    try {
      setIsUploading(true);
      const filePaths = await window.luna.selectFiles();
      if (filePaths.length === 0) {
        setIsUploading(false);
        return;
      }
      
      for (const filePath of filePaths) {
        const file = await window.luna.uploadFile(filePath);
        
        const result = await window.luna.executeTool({
          name: "file_parse",
          arguments: { filePath: file.path, fileName: file.name },
        });
        
        if (result.artifact) {
          setArtifact(result.artifact);
          setShowRightPanel(true);
        }
        
        setTranscript((items) => [
          newEntry("system", `Uploaded: ${file.name}`),
          ...items,
        ].slice(0, 80));
      }
    } catch (error) {
      setTranscript((items) => [
        newEntry("system", `Upload failed: ${error instanceof Error ? error.message : String(error)}`),
        ...items,
      ].slice(0, 80));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleQuickAction(action: string) {
    const result = await window.luna.executeTool({
      name: action,
      arguments: {},
    });
    if (result.artifact) {
      setArtifact(result.artifact);
      setShowRightPanel(true);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F0F0F0]">
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-4 window-drag">
        <div className="flex items-center gap-3 window-no-drag">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: activeAgent?.accent || "#1f2937" }}
          >
            {activeAgent && <AgentIcon icon={activeAgent.icon} className="text-white" />}
          </div>
          <div>
            <span className="font-semibold text-gray-800 tracking-tight">
              {activeAgent?.name || "LUNA"} 
            </span>
            {activeAgent && activeAgent.role !== "General Assistant" && (
              <span className="text-xs text-gray-500 ml-2">{activeAgent.role}</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 window-no-drag">
          <button 
            onClick={() => setShowHoloDemo(true)}
            className="h-9 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 flex items-center gap-2 text-white text-sm font-medium transition-all shadow-lg shadow-blue-500/25"
            title="Open Holographic Demo"
          >
            <span className="text-base">✨</span>
            Holo Demo
          </button>
          <button className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-all">
            <Bell size={18} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-all"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 pt-0 min-h-0">
        {/* Left Sidebar */}
        {showLeftPanel && (
          <aside className="w-72 flex-shrink-0 glass rounded-2xl flex flex-col overflow-hidden shadow-glass">
            {/* Tabs */}
            <div className="p-3 border-b border-black/5">
              <div className="flex gap-1 p-1 bg-black/5 rounded-xl">
                <button 
                  onClick={() => setActiveTab("chats")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "chats" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <MessageSquare size={12} />
                  Chats
                </button>
                <button 
                  onClick={() => setActiveTab("agents")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "agents" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <User size={12} />
                  Agents
                </button>
                <button 
                  onClick={() => setActiveTab("memory")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "memory" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Brain size={12} />
                  Memory
                </button>
                <button 
                  onClick={() => setActiveTab("connectors")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "connectors" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Plug size={12} />
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "chats" && (
                <div className="p-3">
                  {/* New Chat Button */}
                  <button
                    onClick={startNewChat}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-all mb-3"
                  >
                    <Plus size={16} />
                    New Chat
                  </button>

                  {/* Search */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 text-gray-400 mb-3">
                    <Search size={14} />
                    <span className="text-xs flex-1">Search chats...</span>
                  </div>

                  {/* Conversation List */}
                  <div className="space-y-1">
                    {conversations.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No conversations yet</p>
                    ) : (
                      conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => switchConversation(conv.id)}
                          className={`w-full group flex items-start gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                            activeConversationId === conv.id 
                              ? "bg-white shadow-sm" 
                              : "hover:bg-white/60"
                          }`}
                        >
                          <MessageSquare size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">{conv.title}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(conv.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => deleteConv(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "agents" && (
                <div className="p-3">
                  {/* New Agent Form */}
                  {showNewAgent ? (
                    <div className="p-3 rounded-xl bg-white/60 mb-3 space-y-2">
                      <input
                        type="text"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={newAgentRole}
                        onChange={(e) => setNewAgentRole(e.target.value)}
                        placeholder="Role (e.g., Loan Officer)..."
                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none focus:border-blue-400"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={createNewAgent}
                          disabled={!newAgentName.trim() || !newAgentRole.trim()}
                          className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setShowNewAgent(false)}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewAgent(true)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 text-sm transition-all mb-3"
                    >
                      <UserPlus size={16} />
                      Create Agent
                    </button>
                  )}

                  {/* Agent List */}
                  <div className="space-y-1">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => switchAgent(agent.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                          activeAgent?.id === agent.id 
                            ? "bg-white shadow-sm" 
                            : "hover:bg-white/60"
                        }`}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: agent.accent }}
                        >
                          <AgentIcon icon={agent.icon} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                          <p className="text-xs text-gray-500 truncate">{agent.role}</p>
                        </div>
                        {activeAgent?.id === agent.id && (
                          <Check size={16} className="text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "memory" && (
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => handleQuickAction("memory_list")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                  >
                    <Brain size={16} className="text-purple-500" />
                    <span className="text-sm text-gray-700">View Memories</span>
                  </button>
                  <button
                    onClick={() => handleQuickAction("kb_topics")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                  >
                    <Search size={16} className="text-blue-500" />
                    <span className="text-sm text-gray-700">Knowledge Base</span>
                  </button>
                  <div className="mt-4 p-3 rounded-xl bg-purple-50 text-xs text-purple-700">
                    <strong>Memory System</strong><br/>
                    Save important information that Luna remembers across sessions.
                  </div>
                </div>
              )}

              {activeTab === "connectors" && (
                <div className="p-3 space-y-2">
                  <button
                    onClick={() => handleQuickAction("connectors_list")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                  >
                    <Plug size={16} className="text-green-500" />
                    <span className="text-sm text-gray-700">View Connectors</span>
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                  >
                    <Settings size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Manage Settings</span>
                  </button>
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-xs text-emerald-700">
                    <strong>Connectors</strong><br/>
                    Connect to external services like Gmail, web search, and more.
                  </div>
                </div>
              )}
            </div>

            {/* Active Agent Card */}
            {activeAgent && (
              <div className="p-3 border-t border-black/5">
                <div 
                  className="flex items-center gap-3 p-2 rounded-xl transition-all"
                  style={{ background: `${activeAgent.accent}10` }}
                >
                  <div 
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: activeAgent.accent }}
                  >
                    <AgentIcon icon={activeAgent.icon} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{activeAgent.name}</div>
                    <div className="text-xs text-gray-500">{activeAgent.role}</div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Center Stage */}
        <main className="flex-1 glass rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-glass-lg">
          {/* Toggle left panel if hidden */}
          {!showLeftPanel && (
            <button
              onClick={() => setShowLeftPanel(true)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center text-gray-500 shadow-sm transition-all"
            >
              <MessageSquare size={18} />
            </button>
          )}

          {/* Holo Cards Overlay */}
          <HoloDataCards cards={holoCards} onCardsDismissed={() => setHoloCards([])} />

          {/* Luna Avatar with agent accent */}
          <div className="relative">
            <LunaFace mood={mood} size="large" className="mb-6" />
            {activeAgent && activeAgent.id !== "luna-default" && (
              <div 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ background: activeAgent.accent }}
              >
                {activeAgent.role}
              </div>
            )}
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl md:text-5xl font-light text-gray-300 text-center mb-2 tracking-tight">
            What's on
          </h1>
          <h1 className="text-4xl md:text-5xl font-light text-gray-400 text-center mb-12 tracking-tight">
            your mind?
          </h1>

          {/* Floating Input Bar with Upload */}
          <div className="w-full max-w-xl px-4">
            <div className="glass rounded-2xl p-3 shadow-glass-lg">
              {/* Main input row */}
              <div className="flex items-center gap-2">
                {/* Upload button - now in input area */}
                <button 
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-xl bg-white/60 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all disabled:opacity-50"
                  title="Upload file (CSV, PDF, DOCX, images)"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </button>
                
                <input
                  type="text"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendTextPrompt()}
                  placeholder={`Ask ${activeAgent?.name || "Luna"} anything...`}
                  className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm px-2"
                />

                {/* Mute */}
                <button
                  onClick={() => setIsMuted(m => !m)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isMuted ? "bg-red-100 text-red-500" : "bg-white/60 hover:bg-white text-gray-500"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Voice/Call Button */}
                {!isConnected ? (
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white transition-all disabled:opacity-50"
                    title="Start voice call"
                  >
                    {isConnecting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Phone size={20} />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="w-12 h-12 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all animate-pulse-soft"
                    title="End call"
                  >
                    <PhoneOff size={20} />
                  </button>
                )}
              </div>

              {/* Upload hint */}
              <p className="text-xs text-gray-400 text-center mt-2">
                📎 Attach files • 🎤 Voice or type • Powered by {activeAgent?.name || "Luna"}
              </p>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full glass-light">
                <button
                  onClick={() => setVolume(v => v > 0 ? 0 : 80)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 h-1 bg-gray-300 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-600"
                />
              </div>
            )}
            <button
              onClick={handleRestart}
              className="w-9 h-9 rounded-xl glass-light flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-all"
              title="Restart"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setShowRightPanel(p => !p)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                showRightPanel ? "bg-gray-800 text-white" : "glass-light text-gray-500 hover:text-gray-700"
              }`}
              title="Toggle tools panel"
            >
              <PanelRight size={16} />
            </button>
          </div>

          {/* Connection Status */}
          {isConnected && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full glass-light flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-gray-600">
                {mood === "listening" ? "Listening..." : mood === "speaking" ? "Speaking..." : "Connected"}
              </span>
            </div>
          )}
        </main>

        {/* Right Panel - Tool Execution */}
        {showRightPanel && (
          <aside className="w-80 flex-shrink-0 glass rounded-2xl flex flex-col overflow-hidden shadow-glass">
            <div className="p-4 border-b border-black/5 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Tool Execution</h2>
              <button 
                onClick={() => setShowRightPanel(false)}
                className="w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {artifact ? (
                <ArtifactPanel
                  artifact={artifact}
                  visible={true}
                  fullscreen={false}
                  onToggleVisible={() => setShowRightPanel(false)}
                  onToggleFullscreen={() => {}}
                  embedded={true}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <MessageSquare size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Tool outputs, artifacts, and results will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Transcript Preview */}
            {transcript.length > 0 && (
              <div className="border-t border-black/5 p-4 max-h-48 overflow-auto">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Recent</div>
                <div className="space-y-2">
                  {transcript.slice(0, 3).map((entry) => (
                    <div 
                      key={entry.id}
                      className={`text-xs p-2 rounded-lg ${
                        entry.role === "luna" ? "bg-blue-50 text-blue-700" :
                        entry.role === "user" ? "bg-green-50 text-green-700" :
                        "bg-gray-50 text-gray-600"
                      }`}
                    >
                      <span className="font-medium capitalize">
                        {entry.role === "luna" ? (activeAgent?.name || "Luna") : entry.role}: 
                      </span>
                      {entry.text.slice(0, 80)}{entry.text.length > 80 ? "..." : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Holographic Demo */}
      {showHoloDemo && (
        <HoloDemo onClose={() => setShowHoloDemo(false)} />
      )}
    </div>
  );
}
