import { useRef, useState, useCallback, useEffect } from "react";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Plus, Settings, Bell, User, Trash2,
  PanelRight, PanelLeft, RotateCcw, X, Search,
  MessageSquare, ChevronLeft, ChevronRight, Brain, Plug,
  Paperclip, Sparkles, Shield, Calculator, Megaphone,
  Activity, Handshake, UserPlus, Check
} from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { NeuralCore } from "./components/NeuralCore";
import { SettingsPanel } from "./components/SettingsPanel";
import { HoloDemo } from "./components/HoloDemo";
import { HoloDataCards, parseResponseToCards, type HoloCard } from "./components/HoloDataCards";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact, Agent, ConversationSummary } from "./vite-env";

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
  const Icon = AGENT_ICONS[icon] || Sparkles;
  return <Icon size={16} className={className} />;
}

export default function App() {
  const [connectionState, setConnectionState] = useState<LunaConnectionState>("idle");
  const [mood, setMood] = useState<LunaMood>("idle");
  const [artifact, setArtifact] = useState<LunaArtifact | null>(null);
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
  
  // Sidebar state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  
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
        if (activeConversationId && (entry.role === "user" || entry.role === "luna")) {
          await window.luna.addMessage(activeConversationId, entry.role, entry.text);
        }
      },
      onArtifact: (nextArtifact) => {
        setArtifact(nextArtifact);
        setRightCollapsed(false);
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
    
    if (!activeConversationId && activeAgent) {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id);
      await loadConversations();
    }
    
    if (clientRef.current) {
      clientRef.current.sendText(trimmed);
    } else {
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
          setRightCollapsed(false);
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
    const result = await window.luna.executeTool({ name: action, arguments: {} });
    if (result.artifact) {
      setArtifact(result.artifact);
      setRightCollapsed(false);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white font-['Inter',system-ui,sans-serif]">
      {/* Top Bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl window-drag">
        <div className="flex items-center gap-3 window-no-drag">
          <button
            onClick={() => setLeftCollapsed(c => !c)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: activeAgent?.accent || "#6366f1" }}
          >
            {activeAgent && <AgentIcon icon={activeAgent.icon} className="text-white" />}
          </div>
          <span className="text-sm font-medium text-white/90">
            {activeAgent?.name || "SmartStart"}
          </span>
          {activeAgent && activeAgent.role !== "General Assistant" && (
            <span className="text-xs text-white/40 hidden sm:inline">{activeAgent.role}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 window-no-drag">
          <button 
            onClick={() => setShowHoloDemo(true)}
            className="h-8 px-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 flex items-center gap-2 text-white text-xs font-medium transition-all"
          >
            <Sparkles size={14} />
            Holo Demo
          </button>
          <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
            <Bell size={16} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <aside className={`${leftCollapsed ? "w-0" : "w-64"} flex-shrink-0 border-r border-white/5 bg-slate-900/30 backdrop-blur-sm flex flex-col overflow-hidden transition-all duration-300`}>
          {!leftCollapsed && (
            <>
              {/* Tabs */}
              <div className="p-2 border-b border-white/5">
                <div className="flex gap-1">
                  {(["chats", "agents", "memory", "connectors"] as LeftTab[]).map(tab => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                        activeTab === tab 
                          ? "bg-white/10 text-white" 
                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      {tab === "chats" && <MessageSquare size={12} className="mx-auto" />}
                      {tab === "agents" && <User size={12} className="mx-auto" />}
                      {tab === "memory" && <Brain size={12} className="mx-auto" />}
                      {tab === "connectors" && <Plug size={12} className="mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto p-2">
                {activeTab === "chats" && (
                  <div className="space-y-2">
                    <button
                      onClick={startNewChat}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm font-medium transition-all border border-indigo-500/20"
                    >
                      <Plus size={14} />
                      New Chat
                    </button>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-white/40">
                      <Search size={12} />
                      <span className="text-xs">Search chats...</span>
                    </div>

                    <div className="space-y-1 mt-2">
                      {conversations.length === 0 ? (
                        <p className="text-xs text-white/30 text-center py-4">No conversations yet</p>
                      ) : (
                        conversations.map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => switchConversation(conv.id)}
                            className={`w-full group flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-all ${
                              activeConversationId === conv.id 
                                ? "bg-white/10" 
                                : "hover:bg-white/5"
                            }`}
                          >
                            <MessageSquare size={12} className="text-white/40 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/80 truncate">{conv.title}</p>
                              <p className="text-[10px] text-white/30">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={(e) => deleteConv(conv.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-white/30 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "agents" && (
                  <div className="space-y-2">
                    {showNewAgent ? (
                      <div className="p-2 rounded-lg bg-white/5 space-y-2">
                        <input
                          type="text"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          placeholder="Agent name..."
                          className="w-full px-2 py-1.5 rounded-md bg-white/10 border border-white/10 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50"
                        />
                        <input
                          type="text"
                          value={newAgentRole}
                          onChange={(e) => setNewAgentRole(e.target.value)}
                          placeholder="Role..."
                          className="w-full px-2 py-1.5 rounded-md bg-white/10 border border-white/10 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-500/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={createNewAgent}
                            disabled={!newAgentName.trim() || !newAgentRole.trim()}
                            className="flex-1 py-1.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => setShowNewAgent(false)}
                            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewAgent(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 hover:border-white/40 text-white/50 hover:text-white/70 text-xs transition-all"
                      >
                        <UserPlus size={14} />
                        Create Agent
                      </button>
                    )}

                    <div className="space-y-1 mt-2">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => switchAgent(agent.id)}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all ${
                            activeAgent?.id === agent.id ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                        >
                          <div 
                            className="w-6 h-6 rounded-md flex items-center justify-center"
                            style={{ background: agent.accent }}
                          >
                            <AgentIcon icon={agent.icon} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/90">{agent.name}</p>
                            <p className="text-[10px] text-white/40 truncate">{agent.role}</p>
                          </div>
                          {activeAgent?.id === agent.id && (
                            <Check size={12} className="text-green-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "memory" && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleQuickAction("memory_list")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-all"
                    >
                      <Brain size={14} className="text-purple-400" />
                      <span className="text-xs text-white/70">View Memories</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("kb_topics")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-all"
                    >
                      <Search size={14} className="text-blue-400" />
                      <span className="text-xs text-white/70">Knowledge Base</span>
                    </button>
                  </div>
                )}

                {activeTab === "connectors" && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleQuickAction("connectors_list")}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-all"
                    >
                      <Plug size={14} className="text-green-400" />
                      <span className="text-xs text-white/70">View Connectors</span>
                    </button>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-all"
                    >
                      <Settings size={14} className="text-white/40" />
                      <span className="text-xs text-white/70">Settings</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Active Agent */}
              {activeAgent && (
                <div className="p-2 border-t border-white/5">
                  <div 
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: `${activeAgent.accent}15` }}
                  >
                    <div 
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: activeAgent.accent }}
                    >
                      <AgentIcon icon={activeAgent.icon} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white/90">{activeAgent.name}</div>
                      <div className="text-[10px] text-white/40">{activeAgent.role}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Center Stage */}
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          {/* Background grid */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />

          {/* Holo Cards Overlay */}
          <HoloDataCards cards={holoCards} onCardsDismissed={() => setHoloCards([])} />

          {/* Neural Core */}
          <NeuralCore mood={mood} size="large" />

          {/* Hero Text */}
          <div className="mt-8 mb-12 text-center">
            <h1 className="text-3xl font-light text-white/20 tracking-tight">
              What's on your mind?
            </h1>
          </div>

          {/* Floating Input Bar */}
          <div className="w-full max-w-lg px-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-1 border border-white/10 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </button>
                
                <input
                  type="text"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendTextPrompt()}
                  placeholder={`Ask ${activeAgent?.name || "SmartStart"} anything...`}
                  className="flex-1 bg-transparent outline-none text-white/90 placeholder-white/30 text-sm px-2 py-3"
                />

                <button
                  onClick={() => setIsMuted(m => !m)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isMuted ? "bg-red-500/20 text-red-400" : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                {!isConnected ? (
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white transition-all disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Phone size={16} />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={disconnect}
                    className="w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all"
                  >
                    <PhoneOff size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <button
                  onClick={() => setVolume(v => v > 0 ? 0 : 80)}
                  className="text-white/50 hover:text-white"
                >
                  {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>
            )}
            <button
              onClick={handleRestart}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setRightCollapsed(c => !c)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border ${
                rightCollapsed 
                  ? "bg-white/5 hover:bg-white/10 border-white/10 text-white/50 hover:text-white" 
                  : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
              }`}
            >
              <PanelRight size={14} />
            </button>
          </div>

          {/* Connection Status */}
          {isConnected && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/60">
                {mood === "listening" ? "Listening..." : mood === "speaking" ? "Speaking..." : "Connected"}
              </span>
            </div>
          )}
        </main>

        {/* Right Panel */}
        <aside className={`${rightCollapsed ? "w-0" : "w-80"} flex-shrink-0 border-l border-white/5 bg-slate-900/30 backdrop-blur-sm flex flex-col overflow-hidden transition-all duration-300`}>
          {!rightCollapsed && (
            <>
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white/80">Results</h2>
                <button 
                  onClick={() => setRightCollapsed(true)}
                  className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-3">
                {artifact ? (
                  <ArtifactPanel
                    artifact={artifact}
                    visible={true}
                    fullscreen={false}
                    onToggleVisible={() => setRightCollapsed(true)}
                    onToggleFullscreen={() => {}}
                    embedded={true}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                      <MessageSquare size={20} className="text-white/20" />
                    </div>
                    <p className="text-xs text-white/30">
                      Results will appear here
                    </p>
                  </div>
                )}
              </div>

              {transcript.length > 0 && (
                <div className="border-t border-white/5 p-3 max-h-40 overflow-auto">
                  <div className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">Recent</div>
                  <div className="space-y-1">
                    {transcript.slice(0, 3).map((entry) => (
                      <div 
                        key={entry.id}
                        className={`text-xs p-2 rounded-lg ${
                          entry.role === "luna" ? "bg-indigo-500/10 text-indigo-300" :
                          entry.role === "user" ? "bg-green-500/10 text-green-300" :
                          "bg-white/5 text-white/50"
                        }`}
                      >
                        <span className="font-medium">
                          {entry.role === "luna" ? (activeAgent?.name || "Luna") : entry.role}: 
                        </span>
                        {" "}{entry.text.slice(0, 60)}{entry.text.length > 60 ? "..." : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
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
