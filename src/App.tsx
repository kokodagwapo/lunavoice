import { useRef, useState, useMemo } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Keyboard, Send, Expand, PanelRight, History, MonitorCog, RotateCcw } from "lucide-react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import SingularityHorizon, { DEFAULT_SINGULARITY_STATES, type SingularityState } from "./components/ui/singularity-horizon";
import { newEntry, LunaRealtimeClient, type MouthShape, type LunaConnectionState, type LunaMood, type TranscriptEntry } from "./lib/realtime";
import type { LunaArtifact } from "./vite-env";

type LunaMode = "display" | "computer";

const MOOD_STATES: Record<LunaMood, SingularityState> = {
  idle: { name: "STANDBY", coreIntensity: 0.8, diskSpeed: 0.2, particleSpeed: 0.3, colorShift: 0.0, pulseRate: 0.8, turbulence: 0.05 },
  listening: { name: "LISTENING", coreIntensity: 1.2, diskSpeed: 0.4, particleSpeed: 0.6, colorShift: 0.3, pulseRate: 1.5, turbulence: 0.15 },
  thinking: { name: "PROCESSING", coreIntensity: 1.5, diskSpeed: 0.6, particleSpeed: 0.8, colorShift: 0.5, pulseRate: 2.0, turbulence: 0.3 },
  speaking: { name: "TRANSMITTING", coreIntensity: 1.8, diskSpeed: 0.8, particleSpeed: 1.0, colorShift: 0.7, pulseRate: 2.5, turbulence: 0.4 },
  working: { name: "COMPUTING", coreIntensity: 2.0, diskSpeed: 1.0, particleSpeed: 1.2, colorShift: 0.8, pulseRate: 3.0, turbulence: 0.5 },
  error: { name: "ALERT", coreIntensity: 2.5, diskSpeed: 1.5, particleSpeed: 1.5, colorShift: 1.0, pulseRate: 4.0, turbulence: 0.8 },
};

export default function App() {
  const [connectionState, setConnectionState] = useState<LunaConnectionState>("idle");
  const [mood, setMood] = useState<LunaMood>("idle");
  const [mode, setMode] = useState<LunaMode>("display");
  const [artifact, setArtifact] = useState<LunaArtifact | null>(null);
  const [artifactVisible, setArtifactVisible] = useState(true);
  const [artifactFullscreen, setArtifactFullscreen] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [mouthShape, setMouthShape] = useState<MouthShape>({ open: 0, width: 0.18, round: 0, teeth: 0 });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    newEntry("system", "Luna is ready. Connect to start talking."),
  ]);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [textPrompt, setTextPrompt] = useState("");
  const clientRef = useRef<LunaRealtimeClient | null>(null);

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  const singularityState = useMemo(() => MOOD_STATES[mood] || MOOD_STATES.idle, [mood]);

  async function connect() {
    const client = new LunaRealtimeClient({
      onConnectionState: setConnectionState,
      onMood: setMood,
      onMouthShape: setMouthShape,
      onTranscript: (entry) => setTranscript((items) => [entry, ...items].slice(0, 80)),
      onArtifact: (nextArtifact) => {
        setArtifact(nextArtifact);
        setArtifactVisible(true);
        if (nextArtifact.fullscreen) setArtifactFullscreen(true);
      },
      onMode: (nextMode) => {
        setMode(nextMode);
        if (nextMode === "computer") {
          setArtifactVisible(false);
          setArtifactFullscreen(false);
          setShowLog(false);
          setShowTypeInput(false);
        } else {
          setArtifactVisible(true);
        }
      },
      onStatus: (message) => {
        setTranscript((items) => [newEntry("system", message), ...items].slice(0, 80));
      },
      onThumbnailReady: playThumbnailReadySound,
    });
    clientRef.current = client;
    await client.connect();
  }

  function disconnect() {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }

  function toggleMute() {
    setIsMuted((prev) => !prev);
  }

  async function handleRestart() {
    if (isConnected) {
      const confirmed = window.confirm("A call is active. Restart anyway?");
      if (!confirmed) return;
      disconnect();
    }
    await window.luna.restart();
  }

  async function switchMode(nextMode: LunaMode) {
    setMode(nextMode);
    const result = await window.luna.executeTool({ name: "set_mode", arguments: { mode: nextMode } });
    if (result.artifact) setArtifact(result.artifact);
    if (nextMode === "computer") {
      setArtifactVisible(false);
      setArtifactFullscreen(false);
      setShowLog(false);
      setShowTypeInput(false);
    } else {
      setArtifactVisible(true);
    }
    setTranscript((items) => [newEntry("system", `Mode switched to ${nextMode}.`), ...items].slice(0, 80));
  }

  function sendTextPrompt() {
    const trimmed = textPrompt.trim();
    if (!trimmed) return;
    clientRef.current?.sendText(trimmed);
    setTextPrompt("");
    setShowTypeInput(false);
  }

  if (mode === "computer") {
    return (
      <main className="app-shell app-shell-mini">
        <section className="mini-companion" aria-label="Luna mini mode">
          <SingularityHorizon
            width="100%"
            height="100%"
            particles={1500}
            hud={false}
            interactive={false}
            state={singularityState}
            style={{ borderRadius: "50%" }}
          />
          <button
            className="mini-restore-button"
            onClick={() => void switchMode("display")}
            aria-label="Return to full Luna window"
            title="Return to full Luna window"
          >
            <Expand size={14} />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="window-drag-strip" aria-hidden="true" />
      <div className="window-drag-left-zone" aria-hidden="true" />

      <section className="companion-window">
        <section className="face-stage">
          <SingularityHorizon
            width="100%"
            height="100%"
            particles={4000}
            hud={true}
            interactive={true}
            hudTitle="LUNA VOICE"
            hudSubtitle={isConnected ? singularityState.name : "AWAITING CONNECTION"}
            state={singularityState}
          />
        </section>

        <footer className="call-controls">
          <div className="call-controls-primary">
            {!isConnected ? (
              <button
                className="call-button call-button-connect"
                onClick={connect}
                disabled={isConnecting}
                aria-label="Start call"
                title="Start call with Luna"
              >
                <Phone size={24} />
                <span>{isConnecting ? "Connecting..." : "Call"}</span>
              </button>
            ) : (
              <>
                <button
                  className={`call-button call-button-mute ${isMuted ? "muted" : ""}`}
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  className="call-button call-button-end"
                  onClick={disconnect}
                  aria-label="End call"
                  title="End call"
                >
                  <PhoneOff size={24} />
                  <span>End</span>
                </button>
              </>
            )}
          </div>

          {isConnected && (
            <div className="volume-control">
              <button
                className="volume-icon-button"
                onClick={() => setVolume((v) => (v > 0 ? 0 : 80))}
                aria-label={volume === 0 ? "Unmute audio" : "Mute audio"}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="volume-slider"
                aria-label="Volume"
              />
            </div>
          )}

          <div className="call-controls-secondary">
            <button
              className={`icon-button ${showTypeInput ? "active" : ""}`}
              onClick={() => setShowTypeInput((v) => !v)}
              aria-label="Type message"
              title="Type a message"
            >
              <Keyboard size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => void switchMode("computer")}
              aria-label="Computer use mode"
              title="Switch to computer use mode"
            >
              <MonitorCog size={18} />
            </button>
            <button
              className={`icon-button ${artifactVisible ? "active" : ""}`}
              onClick={() => setArtifactVisible((v) => !v)}
              aria-label="Toggle panel"
              title="Toggle artifact panel"
            >
              <PanelRight size={18} />
            </button>
            <button
              className={`icon-button ${showLog ? "active" : ""}`}
              onClick={() => setShowLog((v) => !v)}
              aria-label="Toggle log"
              title="Toggle conversation log"
            >
              <History size={18} />
            </button>
            <button
              className="icon-button"
              onClick={handleRestart}
              aria-label="Restart"
              title="Restart Luna Voice"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </footer>

        {showTypeInput && (
          <div className="text-input-overlay">
            <input
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTextPrompt()}
              autoFocus
              placeholder="Type a message to Luna..."
              className="text-input"
            />
            <button
              onClick={sendTextPrompt}
              className="send-button"
              aria-label="Send"
              disabled={!textPrompt.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        )}

        {showLog && (
          <section className="transcript">
            <div className="section-title">
              <span>Conversation</span>
              <small>{transcript.length}</small>
            </div>
            <div className="transcript-list">
              {transcript.map((entry) => (
                <article className={`entry entry-${entry.role}`} key={entry.id}>
                  <div>
                    <strong>{entry.role === "luna" ? "Luna" : entry.role === "user" ? "You" : entry.role}</strong>
                    <time>{entry.at}</time>
                  </div>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      <ArtifactPanel
        artifact={artifact}
        visible={artifactVisible}
        fullscreen={artifactFullscreen}
        onToggleVisible={() => setArtifactVisible((v) => !v)}
        onToggleFullscreen={() => setArtifactFullscreen((v) => !v)}
      />
    </main>
  );
}

function playThumbnailReadySound() {
  try {
    const AudioContextClass = window.AudioContext;
    const audio = new AudioContextClass();
    const gain = audio.createGain();
    const osc = audio.createOscillator();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audio.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.13);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.14);
    window.setTimeout(() => void audio.close(), 220);
  } catch {
    // Audio cues are optional
  }
}
