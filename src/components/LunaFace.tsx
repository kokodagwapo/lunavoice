import { useEffect, useState } from "react";
import type { LunaMood } from "../lib/realtime";
import lunaAvatar from "../assets/luna-avatar.png";

type LunaFaceProps = {
  mood: LunaMood;
  size?: "small" | "medium" | "large";
  className?: string;
};

const MOOD_CONFIGS: Record<LunaMood, {
  glowColor: string;
  pulseSpeed: string;
  overlayOpacity: number;
  ringColor: string;
  label: string;
}> = {
  idle: {
    glowColor: "rgba(156, 163, 175, 0.3)",
    pulseSpeed: "3s",
    overlayOpacity: 0,
    ringColor: "rgba(156, 163, 175, 0.4)",
    label: "Ready",
  },
  listening: {
    glowColor: "rgba(59, 130, 246, 0.5)",
    pulseSpeed: "1.5s",
    overlayOpacity: 0.1,
    ringColor: "rgba(59, 130, 246, 0.6)",
    label: "Listening...",
  },
  thinking: {
    glowColor: "rgba(168, 85, 247, 0.5)",
    pulseSpeed: "1s",
    overlayOpacity: 0.15,
    ringColor: "rgba(168, 85, 247, 0.6)",
    label: "Thinking...",
  },
  speaking: {
    glowColor: "rgba(16, 185, 129, 0.5)",
    pulseSpeed: "0.8s",
    overlayOpacity: 0.1,
    ringColor: "rgba(16, 185, 129, 0.6)",
    label: "Speaking",
  },
  working: {
    glowColor: "rgba(245, 158, 11, 0.5)",
    pulseSpeed: "0.6s",
    overlayOpacity: 0.2,
    ringColor: "rgba(245, 158, 11, 0.6)",
    label: "Working...",
  },
  error: {
    glowColor: "rgba(239, 68, 68, 0.5)",
    pulseSpeed: "0.4s",
    overlayOpacity: 0.25,
    ringColor: "rgba(239, 68, 68, 0.6)",
    label: "Error",
  },
};

const SIZE_CONFIGS = {
  small: { container: "w-16 h-16", ring: "w-20 h-20", label: "text-xs" },
  medium: { container: "w-48 h-48", ring: "w-56 h-56", label: "text-sm" },
  large: { container: "w-64 h-64", ring: "w-72 h-72", label: "text-base" },
};

export function LunaFace({ mood, size = "large", className = "" }: LunaFaceProps) {
  const config = MOOD_CONFIGS[mood];
  const sizeConfig = SIZE_CONFIGS[size];
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timeout);
  }, [mood]);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Outer glow ring */}
      <div
        className={`absolute ${sizeConfig.ring} rounded-full transition-all duration-500`}
        style={{
          background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
          animation: mood !== "idle" ? `pulse-ring ${config.pulseSpeed} ease-in-out infinite` : "none",
        }}
      />

      {/* Animated ring */}
      <div
        className={`absolute ${sizeConfig.ring} rounded-full border-2 transition-all duration-300`}
        style={{
          borderColor: config.ringColor,
          animation: mood !== "idle" ? `spin-slow 8s linear infinite` : "none",
          opacity: mood === "idle" ? 0.3 : 0.8,
        }}
      />

      {/* Avatar container */}
      <div
        className={`relative ${sizeConfig.container} rounded-full overflow-hidden shadow-xl transition-transform duration-300 ${
          isAnimating ? "scale-105" : "scale-100"
        }`}
        style={{
          boxShadow: `0 0 40px ${config.glowColor}, 0 8px 32px rgba(0,0,0,0.15)`,
        }}
      >
        {/* Avatar image */}
        <img
          src={lunaAvatar}
          alt="Luna"
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Mood overlay */}
        <div
          className="absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${config.glowColor} 0%, transparent 60%)`,
            opacity: config.overlayOpacity,
          }}
        />

        {/* Speaking wave animation */}
        {mood === "speaking" && (
          <div className="absolute bottom-0 left-0 right-0 h-8 flex items-end justify-center gap-1 pb-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white/60 rounded-full"
                style={{
                  animation: `wave 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  height: "8px",
                }}
              />
            ))}
          </div>
        )}

        {/* Listening pulse indicator */}
        {mood === "listening" && (
          <div className="absolute top-2 right-2 w-3 h-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </div>
        )}

        {/* Thinking spinner */}
        {mood === "thinking" && (
          <div className="absolute top-2 right-2">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Working indicator */}
        {mood === "working" && (
          <div className="absolute top-2 right-2 flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-amber-400 rounded-full"
                style={{
                  animation: `bounce 0.6s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Error indicator */}
        {mood === "error" && (
          <div className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        )}
      </div>

      {/* Status label */}
      {size !== "small" && (
        <div
          className={`mt-4 px-4 py-1.5 rounded-full glass ${sizeConfig.label} font-medium transition-all duration-300`}
          style={{ color: config.ringColor.replace("0.6", "1") }}
        >
          {config.label}
        </div>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 20px; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export default LunaFace;
