import { useRef, useState } from "react";
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  Plus, History, Settings, Bell, User,
  PanelRight, RotateCcw, X, Search, Clock, Folder,
  MessageSquare, ChevronRight, FileText, Brain, ClipboardCheck,
  Upload, Paperclip
} from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { LunaFace } from "./components/LunaFace";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact, UploadedFile } from "./vite-env";

type LunaMode = "display" | "computer";
type LeftTab = "timeline" | "memory" | "checklist";

export default function App() {
  const [connectionState, setConnectionState] = useState<LunaConnectionState>("idle");
  const [mood, setMood] = useState<LunaMood>("idle");
  const [mode, setMode] = useState<LunaMode>("display");
  const [artifact, setArtifact] = useState<LunaArtifact | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [mouthShape, setMouthShape] = useState<MouthShape>({ open: 0, width: 0.18, round: 0, teeth: 0 });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    newEntry("system", "Luna is ready. Connect to start talking."),
  ]);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [textPrompt, setTextPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<LeftTab>("timeline");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const clientRef = useRef<LunaRealtimeClient | null>(null);

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  async function connect() {
    const client = new LunaRealtimeClient({
      onConnectionState: setConnectionState,
      onMood: setMood,
      onMouthShape: setMouthShape,
      onTranscript: (entry) => setTranscript((items) => [entry, ...items].slice(0, 80)),
      onArtifact: (nextArtifact) => {
        setArtifact(nextArtifact);
        setShowRightPanel(true);
      },
      onMode: (nextMode) => setMode(nextMode),
      onStatus: (message) => setTranscript((items) => [newEntry("system", message), ...items].slice(0, 80)),
      onThumbnailReady: () => {},
    });
    clientRef.current = client;
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

  function sendTextPrompt() {
    const trimmed = textPrompt.trim();
    if (!trimmed) return;
    clientRef.current?.sendText(trimmed);
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
      
      const uploaded: UploadedFile[] = [];
      for (const filePath of filePaths) {
        const file = await window.luna.uploadFile(filePath);
        uploaded.push(file);
        
        // Parse the file and show in artifact panel
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
      
      setUploadedFiles((prev) => [...uploaded, ...prev]);
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

  const conversationChats = transcript.filter(t => t.role !== "system").slice(0, 10);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F0F0F0]">
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-4 window-drag">
        <div className="flex items-center gap-3 window-no-drag">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">L</span>
          </div>
          <span className="font-semibold text-gray-800 tracking-tight">LUNA VOICE</span>
        </div>
        
        <div className="flex items-center gap-2 window-no-drag">
          <button className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-all">
            <Bell size={18} />
          </button>
          <button className="w-9 h-9 rounded-xl glass flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white/80 transition-all">
            <Settings size={18} />
          </button>
          <button className="h-9 px-3 rounded-xl glass flex items-center gap-2 text-gray-700 hover:bg-white/80 transition-all">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <span className="text-sm font-medium">Luna</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 p-4 pt-0 min-h-0">
        {/* Left Sidebar */}
        {showLeftPanel && (
          <aside className="w-64 flex-shrink-0 glass rounded-2xl flex flex-col overflow-hidden shadow-glass">
            <div className="p-4 border-b border-black/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">History</h2>
                <button 
                  onClick={() => setShowLeftPanel(false)}
                  className="w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400"
                >
                  <PanelRight size={16} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-black/5 rounded-xl">
                <button 
                  onClick={() => setActiveTab("timeline")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "timeline" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Clock size={12} />
                  Chats
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
                  onClick={() => setActiveTab("checklist")}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                    activeTab === "checklist" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <ClipboardCheck size={12} />
                  1003
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 text-gray-400">
                <Search size={16} />
                <span className="text-sm flex-1">Search</span>
                <kbd className="text-xs bg-white/60 px-1.5 py-0.5 rounded">⌘K</kbd>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto px-2">
              {activeTab === "timeline" && (
                <>
                  <div className="px-2 py-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Your Chats</span>
                  </div>
                  {conversationChats.length > 0 ? (
                    <div className="space-y-1">
                      {conversationChats.map((chat) => (
                        <button 
                          key={chat.id}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all group"
                        >
                          <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate flex-1">
                            {chat.text.slice(0, 40)}{chat.text.length > 40 ? "..." : ""}
                          </span>
                          <span className="text-xs text-gray-400">{chat.at}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-gray-400">
                      No conversations yet
                    </div>
                  )}
                </>
              )}

              {activeTab === "memory" && (
                <>
                  <div className="px-2 py-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Memory & Knowledge</span>
                  </div>
                  <div className="space-y-2 p-2">
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
                      <FileText size={16} className="text-blue-500" />
                      <span className="text-sm text-gray-700">Knowledge Base</span>
                    </button>
                    {uploadedFiles.length > 0 && (
                      <>
                        <div className="px-1 pt-2 pb-1">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Uploaded Files</span>
                        </div>
                        {uploadedFiles.slice(0, 5).map((file, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/40 text-sm text-gray-600">
                            <Paperclip size={14} />
                            <span className="truncate">{file.name}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}

              {activeTab === "checklist" && (
                <>
                  <div className="px-2 py-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Loan Application</span>
                  </div>
                  <div className="space-y-2 p-2">
                    <button
                      onClick={() => handleQuickAction("checklist_status")}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                    >
                      <ClipboardCheck size={16} className="text-green-500" />
                      <span className="text-sm text-gray-700">View Progress</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("checklist_next")}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all"
                    >
                      <ChevronRight size={16} className="text-blue-500" />
                      <span className="text-sm text-gray-700">Continue 1003</span>
                    </button>
                    <button
                      onClick={() => handleQuickAction("checklist_reset")}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 text-left transition-all text-amber-600"
                    >
                      <RotateCcw size={16} />
                      <span className="text-sm">Reset Checklist</span>
                    </button>
                    <div className="mt-4 p-3 rounded-xl bg-blue-50 text-xs text-blue-700">
                      <strong>1003 Assistant</strong><br/>
                      Walk through the Uniform Residential Loan Application step by step. 
                      Upload documents for OCR extraction.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Card */}
            <div className="p-3 border-t border-black/5">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">User</div>
                  <div className="text-xs text-gray-400">Free</div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <button className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <span>✨</span>
                Upgrade to Pro
              </button>
            </div>
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
              <History size={18} />
            </button>
          )}

          {/* Luna Avatar */}
          <LunaFace mood={mood} size="large" className="mb-6" />

          {/* Hero Text */}
          <h1 className="text-4xl md:text-5xl font-light text-gray-300 text-center mb-2 tracking-tight">
            What's on
          </h1>
          <h1 className="text-4xl md:text-5xl font-light text-gray-300 text-center tracking-tight">
            <span className="text-gray-400">Your mind</span>
          </h1>
          <h1 className="text-4xl md:text-5xl font-light text-gray-400 text-center mb-12 tracking-tight">
            today?
          </h1>

          {/* Floating Input Bar */}
          <div className="w-full max-w-xl px-4">
            <div className="glass rounded-full p-2 flex items-center gap-2 shadow-glass-lg">
              <button 
                onClick={handleFileUpload}
                disabled={isUploading}
                className="w-10 h-10 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-gray-500 transition-all disabled:opacity-50"
                title="Upload file (CSV, PDF, DOCX, images)"
              >
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus size={20} />
                )}
              </button>
              
              <input
                type="text"
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTextPrompt()}
                placeholder="Ask AI anything..."
                className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm px-2"
              />

              {/* Mute */}
              <button
                onClick={() => setIsMuted(m => !m)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
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
                  className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white transition-all disabled:opacity-50"
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
                  className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all animate-pulse-soft"
                  title="End call"
                >
                  <PhoneOff size={20} />
                </button>
              )}
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

            {/* Tabs */}
            <div className="px-4 py-3 border-b border-black/5">
              <div className="flex gap-1 p-1 bg-black/5 rounded-xl">
                <button className="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-white text-gray-800 shadow-sm flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Summary
                </button>
                <button className="flex-1 py-2 px-3 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Details
                </button>
              </div>
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
            {transcript.length > 1 && (
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
                      <span className="font-medium capitalize">{entry.role === "luna" ? "Luna" : entry.role}: </span>
                      {entry.text.slice(0, 80)}{entry.text.length > 80 ? "..." : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
