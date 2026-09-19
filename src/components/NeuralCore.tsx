import { useEffect, useRef } from "react";
import type { LunaMood } from "../lib/realtime";

type NeuralCoreProps = {
  mood: LunaMood;
  size?: "small" | "medium" | "large";
  className?: string;
};

const MOOD_COLORS: Record<LunaMood, { primary: string; secondary: string; glow: string }> = {
  idle: { primary: "#6366f1", secondary: "#818cf8", glow: "rgba(99, 102, 241, 0.4)" },
  listening: { primary: "#3b82f6", secondary: "#60a5fa", glow: "rgba(59, 130, 246, 0.5)" },
  thinking: { primary: "#8b5cf6", secondary: "#a78bfa", glow: "rgba(139, 92, 246, 0.5)" },
  speaking: { primary: "#10b981", secondary: "#34d399", glow: "rgba(16, 185, 129, 0.5)" },
  working: { primary: "#f59e0b", secondary: "#fbbf24", glow: "rgba(245, 158, 11, 0.5)" },
  error: { primary: "#ef4444", secondary: "#f87171", glow: "rgba(239, 68, 68, 0.5)" },
};

const SIZE_CONFIG = {
  small: { width: 80, height: 80, particles: 30 },
  medium: { width: 160, height: 160, particles: 50 },
  large: { width: 240, height: 240, particles: 80 },
};

export function NeuralCore({ mood, size = "large", className = "" }: NeuralCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    radius: number; angle: number; speed: number; orbit: number;
  }>>([]);

  const config = SIZE_CONFIG[size];
  const colors = MOOD_COLORS[mood];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = config.width * dpr;
    canvas.height = config.height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = config.width / 2;
    const centerY = config.height / 2;

    // Initialize particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < config.particles; i++) {
        const orbit = 20 + Math.random() * (config.width / 2 - 40);
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
          x: centerX + Math.cos(angle) * orbit,
          y: centerY + Math.sin(angle) * orbit,
          vx: 0,
          vy: 0,
          radius: 1 + Math.random() * 2,
          angle,
          speed: 0.002 + Math.random() * 0.008,
          orbit,
        });
      }
    }

    let time = 0;
    const speedMultiplier = mood === "speaking" ? 2 : mood === "thinking" ? 1.5 : mood === "listening" ? 1.2 : 1;

    const animate = () => {
      time += 0.016 * speedMultiplier;
      
      // Clear with fade effect
      ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
      ctx.fillRect(0, 0, config.width, config.height);

      // Draw core glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, config.width / 3);
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(0.5, "rgba(15, 23, 42, 0.3)");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, config.width, config.height);

      // Draw central core
      const coreSize = 12 + Math.sin(time * 2) * 3;
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize);
      coreGradient.addColorStop(0, "#fff");
      coreGradient.addColorStop(0.3, colors.primary);
      coreGradient.addColorStop(1, "transparent");
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw orbit rings
      ctx.strokeStyle = `${colors.secondary}20`;
      ctx.lineWidth = 0.5;
      for (let r = 30; r < config.width / 2; r += 25) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Update and draw particles
      for (const p of particlesRef.current) {
        p.angle += p.speed * speedMultiplier;
        const wobble = Math.sin(time * 3 + p.orbit) * 3;
        p.x = centerX + Math.cos(p.angle) * (p.orbit + wobble);
        p.y = centerY + Math.sin(p.angle) * (p.orbit + wobble);

        // Draw particle
        const alpha = 0.4 + Math.sin(time * 2 + p.angle) * 0.3;
        ctx.fillStyle = `${colors.secondary}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw connection lines to nearby particles
        for (const other of particlesRef.current) {
          if (other === p) continue;
          const dx = other.x - p.x;
          const dy = other.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 40) {
            ctx.strokeStyle = `${colors.primary}${Math.floor((1 - dist / 40) * 40).toString(16).padStart(2, "0")}`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [mood, config, colors]);

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Outer glow */}
      <div 
        className="absolute rounded-full blur-3xl opacity-50"
        style={{
          width: config.width * 1.5,
          height: config.height * 1.5,
          background: colors.glow,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: config.width,
          height: config.height,
          borderRadius: "50%",
        }}
        className="relative z-10"
      />

      {/* Status label */}
      {size !== "small" && (
        <div className="mt-4 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-sm font-medium text-white/70">
          {mood === "idle" ? "Ready" : mood === "listening" ? "Listening..." : mood === "thinking" ? "Processing..." : mood === "speaking" ? "Speaking" : mood === "working" ? "Working..." : "Error"}
        </div>
      )}
    </div>
  );
}

export default NeuralCore;
