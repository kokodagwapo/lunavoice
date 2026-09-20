import { useRef, useState, useCallback, useEffect } from "react";
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Plus, Settings, Bell, User, Trash2,
  PanelRight, RotateCcw, X, Search, Moon, Sun,
  MessageSquare, Brain, Plug,
  Paperclip, Sparkles, Shield, Calculator, Megaphone,
  Activity, Handshake, UserPlus, Check, ChevronLeft, ChevronRight,
  Monitor, MonitorOff, Minus, Square,
} from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { LunaFace } from "./components/LunaFace";
import { SettingsPanel } from "./components/SettingsPanel";
import { HoloDemo } from "./components/HoloDemo";
import { HoloDataCards, parseResponseToCards, type HoloCard } from "./components/HoloDataCards";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact, Agent, ConversationSummary } from "./vite-env";

type LeftTab = "chats" | "agents" | "memory" | "connectors";
type UiTheme = "dark" | "light";

const LEFT_TABS: { id: LeftTab; label: string }[] = [
  { id: "chats", label: "Chats" },
  { id: "agents", label: "Agents" },
  { id: "memory", label: "Memory" },
  { id: "connectors", label: "Connect" },
];

const AGENT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles, calculator: Calculator, shield: Shield,
  megaphone: Megaphone, activity: Activity, handshake: Handshake, user: User,
};

function AgentIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = AGENT_ICONS[icon] || Sparkles;
  return <Icon size={14} className={className} />;
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [computerMode, setComputerMode] = useState(false);
  const [theme, setTheme] = useState<UiTheme>(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("luna-theme") === "light" ? "light" : "dark";
  });

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

  useEffect(() => { loadAgents(); loadMode(); }, []);
  useEffect(() => { if (activeAgent) loadConversations(); }, [activeAgent?.id]);
  useEffect(() => {
    window.localStorage.setItem("luna-theme", theme);
  }, [theme]);

  async function loadMode() {
    try {
      const mode = await window.luna.getMode();
      setComputerMode(mode === "computer");
    } catch (e) { console.error(e); }
  }

  async function toggleComputerMode() {
    try {
      const newMode = computerMode ? "display" : "computer";
      const result = await window.luna.setMode(newMode);
      if (result.ok) setComputerMode(result.mode === "computer");
    } catch (e) { console.error(e); }
  }

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
    client.setOutputVolume(volume);
    if (isMuted) client.setMicMuted(true);
  }

  function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    clientRef.current?.setMicMuted(next);
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
        if (result.artifact) { 
          setArtifact(result.artifact); 
          setRightCollapsed(false);
          if (result.artifact.content) {
            const cards = parseResponseToCards(result.artifact.content, result.artifact.kind);
            addHoloCards(cards);
          }
        }
        setTranscript((items) => [newEntry("system", `Uploaded: ${file.name}`), ...items].slice(0, 80));
      }
    } catch (error) {
      setTranscript((items) => [newEntry("system", `Upload failed: ${error instanceof Error ? error.message : String(error)}`), ...items].slice(0, 80));
    } finally { setIsUploading(false); }
  }

  async function handleQuickAction(action: string, args: Record<string, unknown> = {}) {
    const result = await window.luna.executeTool({ name: action, arguments: args });
    if (result.artifact) { 
      setArtifact(result.artifact); 
      setRightCollapsed(false); 
      // Wire holo cards to live structured responses
      if (result.artifact.content) {
        const cards = parseResponseToCards(result.artifact.content, result.artifact.kind);
        addHoloCards(cards);
      }
    }
  }

  const stageStatus = isConnected
    ? mood === "listening"
      ? "Listening"
      : mood === "speaking"
        ? "Speaking"
        : mood === "thinking"
          ? "Processing"
          : "Live"
    : isConnecting
      ? "Connecting"
      : "Ready";

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="app-topbar window-drag">
        <div className="brand window-no-drag">
          <button type="button" onClick={() => setLeftCollapsed((c) => !c)} className="icon-btn" aria-label="Toggle sidebar">
            {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand-name">{activeAgent?.name || "Luna"}</p>
            <p className="brand-meta">{activeAgent?.role || "Voice companion"}</p>
          </div>
        </div>

        <div className="topbar-status window-no-drag">
          <span className={`status-dot status-dot-${connectionState}`} />
          <span className="status-label">{stageStatus}</span>
        </div>

        <div className="topbar-actions window-no-drag">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            aria-pressed={theme === "light"}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            <Moon size={13} strokeWidth={1.5} />
            <span className={`theme-toggle-thumb ${theme === "light" ? "is-light" : ""}`}>
              {theme === "light" ? <Sun size={11} strokeWidth={1.8} /> : <Moon size={11} strokeWidth={1.8} />}
            </span>
            <Sun size={13} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowHoloDemo(true)} title="Holo demo">
            <Sparkles size={16} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" title="Notifications" aria-label="Notifications">
            <Bell size={16} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
            <Settings size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className={`icon-btn ${!rightCollapsed ? "icon-btn-active" : ""}`}
            onClick={() => setRightCollapsed((c) => !c)}
            title="Results"
            aria-label="Toggle results"
          >
            <PanelRight size={16} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" onClick={() => void handleRestart()} title="Restart" aria-label="Restart">
            <RotateCcw size={16} strokeWidth={1.5} />
          </button>
          <span style={{ width: 1, height: 16, background: "var(--luna-border)", margin: "0 4px" }} />
          <button type="button" className="icon-btn" onClick={() => void window.luna.minimize()} title="Minimize" aria-label="Minimize">
            <Minus size={16} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn" onClick={() => void window.luna.maximize()} title="Maximize" aria-label="Maximize">
            <Square size={14} strokeWidth={1.5} />
          </button>
          <button type="button" className="icon-btn icon-btn-close" onClick={() => void window.luna.close()} title="Close" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="workspace">
        {!leftCollapsed && (
        <aside className="tools-rail window-no-drag">
              <div className="tools-tabs">
                {LEFT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`tools-tab ${activeTab === tab.id ? "tools-tab-active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="tools-panel tools-section">
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
                      <div key={conv.id} role="button" tabIndex={0} onClick={() => switchConversation(conv.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && switchConversation(conv.id)} className={`w-full group flex items-start gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer ${activeConversationId === conv.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                        <MessageSquare size={10} className="text-white/30 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white/70 truncate">{conv.title}</p>
                          <p className="text-[9px] text-white/25">{new Date(conv.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={(e) => deleteConv(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-white/20 hover:text-red-400 transition-all"><Trash2 size={10} /></button>
                      </div>
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
                <div className="tools-panel" style={{ borderTop: "1px solid var(--luna-border)", paddingTop: 10 }}>
                  <p className="tools-hint">
                    <strong>{activeAgent.name}</strong> — {activeAgent.role}
                  </p>
                </div>
              )}
        </aside>
        )}

        <main className="stage">
          <HoloDataCards cards={holoCards} onCardsDismissed={() => setHoloCards([])} />
          <LunaFace
            mood={mood}
            mouthOpen={mouthShape.open}
            audioLevel={mouthShape.open}
            live={isConnected}
            theme={theme}
          />
          <div className="stage-vignette" aria-hidden="true" />

          <div className="stage-copy">
            <p className="stage-kicker">
              <Sparkles size={14} strokeWidth={1.5} />
              {computerMode ? "Computer Mode" : stageStatus}
              {computerMode && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981", marginLeft: 6, animation: "pulse 2s infinite" }} />}
            </p>
            <h1>What&apos;s on your mind?</h1>
            <p className="stage-subtitle">
              {computerMode 
                ? "Computer control enabled. Say what you want me to do."
                : isConnected 
                  ? "Speak or type — Luna is listening." 
                  : "Start a call or send a message below."}
            </p>
            <button 
              type="button"
              onClick={() => void toggleComputerMode()}
              className={`mode-toggle ${computerMode ? "mode-toggle-active" : ""}`}
              title={computerMode ? "Switch to Luna mode" : "Switch to Computer mode"}
              style={{
                marginTop: 12,
                padding: "6px 12px",
                borderRadius: 8,
                border: computerMode ? "1px solid rgba(16,185,129,0.4)" : "1px solid var(--luna-border)",
                background: computerMode ? "rgba(16,185,129,0.15)" : "transparent",
                color: computerMode ? "#10b981" : "var(--luna-text-muted)",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {computerMode ? <Monitor size={14} /> : <MonitorOff size={14} />}
              {computerMode ? "Computer Mode On" : "Enable Computer Mode"}
            </button>
          </div>

          <form
            className="composer window-no-drag"
            onSubmit={(e) => {
              e.preventDefault();
              void sendTextPrompt();
            }}
          >
            <button type="button" className="composer-btn" onClick={() => void handleFileUpload()} disabled={isUploading} title="Attach file">
              {isUploading ? <span className="spinner" /> : <Paperclip size={16} strokeWidth={1.5} />}
            </button>
            <input
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder={`Ask ${activeAgent?.name || "Luna"}…`}
              aria-label="Message Luna"
            />
            {isConnected ? (
              <button
                type="button"
                className={`composer-btn ${isMuted ? "composer-btn-warn" : ""}`}
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            ) : null}
            {!isConnected ? (
              <button type="button" className="call-btn" onClick={() => void connect()} disabled={isConnecting}>
                {isConnecting ? <span className="spinner" /> : <Phone size={18} strokeWidth={1.5} />}
                <span>{isConnecting ? "Connecting" : "Call"}</span>
              </button>
            ) : (
              <button type="button" className="call-btn call-btn-end" onClick={disconnect}>
                <PhoneOff size={18} strokeWidth={1.5} />
                <span>End</span>
              </button>
            )}
          </form>

          {isConnected && (
            <div className="topbar-actions window-no-drag" style={{ position: "absolute", right: 12, bottom: 88, gap: 6 }}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  const next = volume > 0 ? 0 : 80;
                  setVolume(next);
                  clientRef.current?.setOutputVolume(next);
                }}
                aria-label="Volume"
              >
                {volume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  clientRef.current?.setOutputVolume(v);
                }}
                className="window-no-drag"
                style={{ width: 72 }}
                aria-label="Volume"
              />
            </div>
          )}
        </main>

        {!rightCollapsed && (
        <aside className="artifact-rail window-no-drag">
              <div className="panel-head">
                <h2>Results</h2>
                <button type="button" className="icon-btn" onClick={() => setRightCollapsed(true)} aria-label="Close results">
                  <X size={16} />
                </button>
              </div>
              <div className="artifact-rail-body">
                {artifact ? (
                  <ArtifactPanel artifact={artifact} visible={true} fullscreen={false} onToggleVisible={() => setRightCollapsed(true)} onToggleFullscreen={() => {}} embedded={true} />
                ) : (
                  <div className="empty-rail">
                    <MessageSquare size={22} strokeWidth={1.5} />
                    <p>Results and tools show up here during a session.</p>
                  </div>
                )}
              </div>
        </aside>
        )}
      </div>

      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />
      {showHoloDemo && <HoloDemo onClose={() => setShowHoloDemo(false)} />}
    </div>
  );
}
