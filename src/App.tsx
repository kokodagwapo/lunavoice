import { useRef, useState, useCallback, useEffect } from "react";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Plus, Settings, Bell, User, Trash2,
  PanelRight, PanelLeft, RotateCcw, X, Search,
  MessageSquare, Brain, Plug,
  Paperclip, Sparkles, Shield, Calculator, Megaphone,
  Activity, Handshake, UserPlus, Check, ChevronLeft, ChevronRight
} from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import SingularityHorizon, { DEFAULT_SINGULARITY_STATES } from "./components/ui/singularity-horizon";
import { SettingsPanel } from "./components/SettingsPanel";
import { HoloDemo } from "./components/HoloDemo";
import { HoloDataCards, parseResponseToCards, type HoloCard } from "./components/HoloDataCards";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact, Agent, ConversationSummary } from "./vite-env";

type LeftTab = "chats" | "agents" | "memory" | "connectors";

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles, calculator: Calculator, shield: Shield,
  megaphone: Megaphone, activity: Activity, handshake: Handshake, user: User,
};

function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = AGENT_ICONS[icon] || Sparkles;
  return <Icon size={14} className={className} />;
}

// Map mood to singularity state
const MOOD_TO_STATE: Record<LunaMood, number> = {
  idle: 0, listening: 1, thinking: 2, speaking: 1, working: 2, error: 3,
};

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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  const clientRef = useRef<LunaRealtimeClient | null>(null);
  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { if (activeAgent) loadConversations(); }, [activeAgent?.id]);

  async function loadAgents() {
    try {
      const data = await window.luna.listAgents();
      setAgents(data.agents);
      setActiveAgent(data.agents.find(a => a.id === data.activeAgentId) || data.agents[0]);
    } catch (e) { console.error(e); }
  }

  async function loadConversations() {
    try { setConversations(await window.luna.listConversations(activeAgent?.id)); } catch (e) { console.error(e); }
  }

  async function switchAgent(agentId: string) {
    try {
      const result = await window.luna.setActiveAgent(agentId);
      if (result.ok && result.agent) { setActiveAgent(result.agent); setTranscript([]); setActiveConversationId(null); }
    } catch (e) { console.error(e); }
  }

  async function createNewAgent() {
    if (!newAgentName.trim() || !newAgentRole.trim()) return;
    try {
      const result = await window.luna.createAgent({ name: newAgentName.trim(), role: newAgentRole.trim() });
      if (result.ok) { await loadAgents(); setShowNewAgent(false); setNewAgentName(""); setNewAgentRole(""); }
    } catch (e) { console.error(e); }
  }

  async function startNewChat() {
    if (!activeAgent) return;
    try {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id); setTranscript([]); await loadConversations();
    } catch (e) { console.error(e); }
  }

  async function switchConversation(convId: string) {
    try {
      const conv = await window.luna.getConversation(convId);
      if (conv) {
        setActiveConversationId(conv.id);
        setTranscript(conv.messages.map(m => ({
          id: m.id, role: m.role as TranscriptEntry["role"], text: m.text,
          at: new Date(m.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        })).reverse());
      }
    } catch (e) { console.error(e); }
  }

  async function deleteConv(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await window.luna.deleteConversation(convId);
      if (activeConversationId === convId) { setActiveConversationId(null); setTranscript([]); }
      await loadConversations();
    } catch (e) { console.error(e); }
  }

  const addHoloCards = useCallback((cards: HoloCard[]) => { if (cards.length > 0) setHoloCards(prev => [...prev, ...cards]); }, []);

  async function connect() {
    const client = new LunaRealtimeClient({
      onConnectionState: setConnectionState, onMood: setMood, onMouthShape: setMouthShape,
      onTranscript: async (entry) => {
        setTranscript((items) => [entry, ...items].slice(0, 80));
        if (activeConversationId && (entry.role === "user" || entry.role === "luna"))
          await window.luna.addMessage(activeConversationId, entry.role, entry.text);
      },
      onArtifact: (a) => { setArtifact(a); setRightCollapsed(false); if (a?.content) addHoloCards(parseResponseToCards(a.content, a.kind)); },
      onMode: () => {},
      onStatus: (msg) => setTranscript((items) => [newEntry("system", msg), ...items].slice(0, 80)),
      onThumbnailReady: () => {},
    });
    clientRef.current = client;
    if (!activeConversationId && activeAgent) {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id); await loadConversations();
    }
    await client.connect();
  }

  function disconnect() { clientRef.current?.disconnect(); clientRef.current = null; }

  async function handleRestart() {
    if (isConnected && !window.confirm("A call is active. Restart anyway?")) return;
    disconnect(); await window.luna.restart();
  }

  async function sendTextPrompt() {
    const trimmed = textPrompt.trim();
    if (!trimmed) return;
    if (!activeConversationId && activeAgent) {
      const conv = await window.luna.createConversation(activeAgent.id, activeAgent.name);
      setActiveConversationId(conv.id); await loadConversations();
    }
    if (clientRef.current) clientRef.current.sendText(trimmed);
    else {
      setTranscript((items) => [newEntry("user", trimmed), ...items].slice(0, 80));
      if (activeConversationId) await window.luna.addMessage(activeConversationId, "user", trimmed);
    }
    setTextPrompt("");
  }

  async function handleFileUpload() {
    try {
      setIsUploading(true);
      const filePaths = await window.luna.selectFiles();
      if (filePaths.length === 0) { setIsUploading(false); return; }
      for (const filePath of filePaths) {
        const file = await window.luna.uploadFile(filePath);
        const result = await window.luna.executeTool({ name: "file_parse", arguments: { filePath: file.path, fileName: file.name } });
        if (result.artifact) { setArtifact(result.artifact); setRightCollapsed(false); }
        setTranscript((items) => [newEntry("system", `Uploaded: ${file.name}`), ...items].slice(0, 80));
      }
    } catch (error) {
      setTranscript((items) => [newEntry("system", `Upload failed: ${error instanceof Error ? error.message : String(error)}`), ...items].slice(0, 80));
    } finally { setIsUploading(false); }
  }

  async function handleQuickAction(action: string) {
    const result = await window.luna.executeTool({ name: action, arguments: {} });
    if (result.artifact) { setArtifact(result.artifact); setRightCollapsed(false); }
  }

  const singularityState = DEFAULT_SINGULARITY_STATES[MOOD_TO_STATE[mood] || 0];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0f] text-white/90 font-[system-ui,-apple-system,sans-serif] antialiased">
      {/* Header */}
      <header className="h-11 flex items-center justify-between px-3 bg-[#0d0d14]/80 backdrop-blur-xl border-b border-white/[0.04] window-drag">
        <div className="flex items-center gap-2.5 window-no-drag">
          <button onClick={() => setLeftCollapsed(c => !c)} className="w-7 h-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
            {leftCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: activeAgent?.accent || "#6366f1" }}>
            {activeAgent && <AgentIcon icon={activeAgent.icon} className="text-white" />}
          </div>
          <span className="text-[13px] font-medium text-white/80">{activeAgent?.name || "SmartStart"}</span>
          {activeAgent && activeAgent.role !== "General Assistant" && (
            <span className="text-[11px] text-white/30">{activeAgent.role}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 window-no-drag">
          <button onClick={() => setShowHoloDemo(true)} className="h-7 px-2.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/20 flex items-center gap-1.5 text-indigo-300 text-[11px] font-medium transition-colors">
            <Sparkles size={12} /> Holo Demo
          </button>
          <button className="w-7 h-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"><Bell size={14} /></button>
          <button onClick={() => setShowSettings(true)} className="w-7 h-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"><Settings size={14} /></button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar */}
        <aside className={`${leftCollapsed ? "w-0 opacity-0" : "w-56 opacity-100"} flex-shrink-0 border-r border-white/[0.04] bg-[#0d0d14]/50 flex flex-col overflow-hidden transition-all duration-200`}>
          {!leftCollapsed && (
            <>
              <div className="p-2 border-b border-white/[0.04]">
                <div className="flex rounded-md bg-white/[0.03] p-0.5">
                  {(["chats", "agents", "memory", "connectors"] as LeftTab[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors ${activeTab === tab ? "bg-white/[0.08] text-white/80" : "text-white/40 hover:text-white/60"}`}>
                      {tab === "chats" && <MessageSquare size={10} className="mx-auto" />}
                      {tab === "agents" && <User size={10} className="mx-auto" />}
                      {tab === "memory" && <Brain size={10} className="mx-auto" />}
                      {tab === "connectors" && <Plug size={10} className="mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-2 space-y-1">
                {activeTab === "chats" && (
                  <>
                    <button onClick={startNewChat} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/10 text-indigo-300 text-[11px] font-medium transition-colors">
                      <Plus size={12} /> New Chat
                    </button>
                    <div className="flex items-center gap-1.5 px-2 py-1 text-white/30">
                      <Search size={10} /><span className="text-[10px]">Search...</span>
                    </div>
                    {conversations.length === 0 ? (
                      <p className="text-[10px] text-white/20 text-center py-4">No conversations</p>
                    ) : conversations.map(conv => (
                      <button key={conv.id} onClick={() => switchConversation(conv.id)} className={`w-full group flex items-start gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors ${activeConversationId === conv.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                        <MessageSquare size={10} className="text-white/30 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white/70 truncate">{conv.title}</p>
                          <p className="text-[9px] text-white/25">{new Date(conv.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={(e) => deleteConv(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-white/20 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                      </button>
                    ))}
                  </>
                )}
                {activeTab === "agents" && (
                  <>
                    {showNewAgent ? (
                      <div className="p-2 rounded-md bg-white/[0.03] space-y-1.5">
                        <input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="Name..." className="w-full px-2 py-1 rounded bg-white/[0.05] border border-white/[0.06] text-[11px] text-white placeholder-white/30 outline-none focus:border-indigo-500/30" />
                        <input value={newAgentRole} onChange={(e) => setNewAgentRole(e.target.value)} placeholder="Role..." className="w-full px-2 py-1 rounded bg-white/[0.05] border border-white/[0.06] text-[11px] text-white placeholder-white/30 outline-none focus:border-indigo-500/30" />
                        <div className="flex gap-1">
                          <button onClick={createNewAgent} disabled={!newAgentName.trim() || !newAgentRole.trim()} className="flex-1 py-1 rounded bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-medium disabled:opacity-40">Create</button>
                          <button onClick={() => setShowNewAgent(false)} className="px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.08] text-white/60 text-[10px]">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewAgent(true)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 text-[11px] transition-colors">
                        <UserPlus size={12} /> Create Agent
                      </button>
                    )}
                    {agents.map(agent => (
                      <button key={agent.id} onClick={() => switchAgent(agent.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${activeAgent?.id === agent.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: agent.accent }}><AgentIcon icon={agent.icon} className="text-white" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-white/80">{agent.name}</p>
                          <p className="text-[9px] text-white/30 truncate">{agent.role}</p>
                        </div>
                        {activeAgent?.id === agent.id && <Check size={10} className="text-green-400" />}
                      </button>
                    ))}
                  </>
                )}
                {activeTab === "memory" && (
                  <>
                    <button onClick={() => handleQuickAction("memory_list")} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03] text-left transition-colors">
                      <Brain size={12} className="text-purple-400" /><span className="text-[11px] text-white/60">View Memories</span>
                    </button>
                    <button onClick={() => handleQuickAction("kb_topics")} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03] text-left transition-colors">
                      <Search size={12} className="text-blue-400" /><span className="text-[11px] text-white/60">Knowledge Base</span>
                    </button>
                  </>
                )}
                {activeTab === "connectors" && (
                  <>
                    <button onClick={() => handleQuickAction("connectors_list")} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03] text-left transition-colors">
                      <Plug size={12} className="text-green-400" /><span className="text-[11px] text-white/60">View Connectors</span>
                    </button>
                    <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03] text-left transition-colors">
                      <Settings size={12} className="text-white/30" /><span className="text-[11px] text-white/60">Settings</span>
                    </button>
                  </>
                )}
              </div>

              {activeAgent && (
                <div className="p-2 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: `${activeAgent.accent}10` }}>
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: activeAgent.accent }}><AgentIcon icon={activeAgent.icon} className="text-white" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-white/80">{activeAgent.name}</div>
                      <div className="text-[9px] text-white/30">{activeAgent.role}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Center Stage */}
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`, backgroundSize: "32px 32px" }} />
          
          {/* Holo Cards */}
          <HoloDataCards cards={holoCards} onCardsDismissed={() => setHoloCards([])} />

          {/* Neural Network (Singularity Horizon) */}
          <div className="relative w-72 h-72 mb-6">
            <SingularityHorizon
              width="100%"
              height="100%"
              particles={3000}
              hud={false}
              interactive={true}
              autoRotate={true}
              state={singularityState}
              style={{ borderRadius: "50%", background: "transparent" }}
            />
          </div>

          {/* Status */}
          <div className="mb-8 text-center">
            <div className="text-[11px] font-medium text-white/30 uppercase tracking-widest mb-1">
              {isConnected ? (mood === "listening" ? "Listening" : mood === "speaking" ? "Speaking" : mood === "thinking" ? "Processing" : "Ready") : "Offline"}
            </div>
            <h1 className="text-xl font-light text-white/15 tracking-tight">What's on your mind?</h1>
          </div>

          {/* Input */}
          <div className="w-full max-w-md px-6">
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-1 shadow-2xl shadow-black/30">
              <div className="flex items-center">
                <button onClick={handleFileUpload} disabled={isUploading} className="w-9 h-9 rounded-lg hover:bg-white/[0.05] flex items-center justify-center text-white/30 hover:text-white/50 transition-colors disabled:opacity-40">
                  {isUploading ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Paperclip size={15} />}
                </button>
                <input
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendTextPrompt()}
                  placeholder={`Ask ${activeAgent?.name || "SmartStart"}...`}
                  className="flex-1 bg-transparent outline-none text-white/80 placeholder-white/20 text-[13px] py-2.5"
                />
                <button onClick={() => setIsMuted(m => !m)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isMuted ? "bg-red-500/15 text-red-400" : "hover:bg-white/[0.05] text-white/30 hover:text-white/50"}`}>
                  {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                {!isConnected ? (
                  <button onClick={connect} disabled={isConnecting} className="w-9 h-9 rounded-lg bg-indigo-500 hover:bg-indigo-600 flex items-center justify-center text-white transition-colors disabled:opacity-50">
                    {isConnecting ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Phone size={15} />}
                  </button>
                ) : (
                  <button onClick={disconnect} className="w-9 h-9 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors">
                    <PhoneOff size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
            {isConnected && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                <button onClick={() => setVolume(v => v > 0 ? 0 : 80)} className="text-white/30 hover:text-white/50"><Volume2 size={12} /></button>
                <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-12 h-0.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/50" />
              </div>
            )}
            <button onClick={handleRestart} className="w-7 h-7 rounded-lg hover:bg-white/[0.05] border border-white/[0.04] flex items-center justify-center text-white/30 hover:text-white/50 transition-colors"><RotateCcw size={12} /></button>
            <button onClick={() => setRightCollapsed(c => !c)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors border ${rightCollapsed ? "border-white/[0.04] hover:bg-white/[0.05] text-white/30" : "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"}`}><PanelRight size={12} /></button>
          </div>
        </main>

        {/* Right Panel */}
        <aside className={`${rightCollapsed ? "w-0 opacity-0" : "w-72 opacity-100"} flex-shrink-0 border-l border-white/[0.04] bg-[#0d0d14]/50 flex flex-col overflow-hidden transition-all duration-200`}>
          {!rightCollapsed && (
            <>
              <div className="p-2.5 border-b border-white/[0.04] flex items-center justify-between">
                <span className="text-[11px] font-medium text-white/50">Results</span>
                <button onClick={() => setRightCollapsed(true)} className="w-5 h-5 rounded hover:bg-white/[0.05] flex items-center justify-center text-white/30"><X size={12} /></button>
              </div>
              <div className="flex-1 overflow-auto p-2.5">
                {artifact ? (
                  <ArtifactPanel artifact={artifact} visible={true} fullscreen={false} onToggleVisible={() => setRightCollapsed(true)} onToggleFullscreen={() => {}} embedded={true} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center mb-2"><MessageSquare size={16} className="text-white/15" /></div>
                    <p className="text-[10px] text-white/20">Results appear here</p>
                  </div>
                )}
              </div>
              {transcript.length > 0 && (
                <div className="border-t border-white/[0.04] p-2.5 max-h-32 overflow-auto">
                  <div className="text-[9px] font-medium text-white/20 uppercase tracking-wider mb-1.5">Recent</div>
                  <div className="space-y-1">
                    {transcript.slice(0, 3).map(entry => (
                      <div key={entry.id} className={`text-[10px] px-2 py-1 rounded ${entry.role === "luna" ? "bg-indigo-500/10 text-indigo-300/80" : entry.role === "user" ? "bg-green-500/10 text-green-300/80" : "bg-white/[0.03] text-white/40"}`}>
                        <span className="font-medium">{entry.role === "luna" ? activeAgent?.name || "Luna" : entry.role}:</span> {entry.text.slice(0, 50)}{entry.text.length > 50 ? "..." : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />
      {showHoloDemo && <HoloDemo onClose={() => setShowHoloDemo(false)} />}
    </div>
  );
}
