import type { LunaMood } from "../lib/realtime";
import NeuralNetwork, { type NeuralNetState, type NeuralTheme } from "./ui/neural-network";

type LunaFaceProps = {
  mood: LunaMood;
  mouthOpen?: number;
  audioLevel?: number;
  live?: boolean;
  theme?: NeuralTheme;
  className?: string;
};

const MOOD_STATES: Record<LunaMood, NeuralNetState> = {
  idle: { name: "READY", activity: 0.65, pulseRate: 0.9, colorShift: 0.12, turbulence: 0.1, spin: 0.7 },
  listening: { name: "LISTENING", activity: 1.05, pulseRate: 1.35, colorShift: 0.08, turbulence: 0.16, spin: 1.15 },
  thinking: { name: "THINKING", activity: 1.45, pulseRate: 1.9, colorShift: 0.38, turbulence: 0.32, spin: 1.6 },
  speaking: { name: "SPEAKING", activity: 1.7, pulseRate: 2.2, colorShift: 0.22, turbulence: 0.2, spin: 1.8 },
  working: { name: "WORKING", activity: 1.6, pulseRate: 2.4, colorShift: 0.48, turbulence: 0.36, spin: 1.7 },
  error: { name: "ERROR", activity: 1.9, pulseRate: 3.1, colorShift: 0.92, turbulence: 0.5, spin: 2.2 },
};

export function LunaFace({
  mood,
  mouthOpen = 0,
  audioLevel = 0,
  live = false,
  theme = "dark",
  className = "",
}: LunaFaceProps) {
  const base = MOOD_STATES[mood];
  const voice = mood === "speaking" ? Math.max(mouthOpen, audioLevel) : audioLevel;
  const wave = live ? Math.min(1, (mood === "idle" ? 0.12 : 0.22) + voice * 0.95) : 0.05;
  const state: NeuralNetState = {
    ...base,
    activity: base.activity + voice * 0.7,
    pulseRate: base.pulseRate + voice * 0.9,
    turbulence: Math.min(0.75, base.turbulence + voice * 0.18),
    wave,
    spin: (base.spin ?? 1) * (live ? 1 + voice * 0.8 : 0.7),
  };

  return (
    <div className={`luna-presence ${className}`} aria-hidden="true">
      <NeuralNetwork
        width="100%"
        height="100%"
        nodes={142}
        interactive
        autoRotate
        theme={theme}
        state={state}
        style={{ borderRadius: 0, background: "transparent" }}
      />
    </div>
  );
}

export default LunaFace;
