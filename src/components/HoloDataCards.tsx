import { useEffect, useState, useRef, useCallback } from "react";
import { TrendingUp, BarChart3, FileText, Search, Brain, Database, Percent, DollarSign, Calendar, AlertCircle } from "lucide-react";

export type HoloCard = {
  id: string;
  title: string;
  lines: string[];
  metric?: { value: string; label: string; trend?: "up" | "down" | "neutral" };
  kind: "data" | "analysis" | "search" | "memory" | "alert" | "rate" | "stat";
  delay?: number;
};

type HoloDataCardsProps = {
  cards: HoloCard[];
  onCardsDismissed?: () => void;
};

const KIND_ICONS: Record<HoloCard["kind"], React.ComponentType<{ size?: number; className?: string }>> = {
  data: BarChart3,
  analysis: Brain,
  search: Search,
  memory: Database,
  alert: AlertCircle,
  rate: Percent,
  stat: TrendingUp,
};

const KIND_COLORS: Record<HoloCard["kind"], { border: string; glow: string; accent: string }> = {
  data: { border: "rgba(59, 130, 246, 0.6)", glow: "rgba(59, 130, 246, 0.3)", accent: "#3B82F6" },
  analysis: { border: "rgba(168, 85, 247, 0.6)", glow: "rgba(168, 85, 247, 0.3)", accent: "#A855F7" },
  search: { border: "rgba(14, 165, 233, 0.6)", glow: "rgba(14, 165, 233, 0.3)", accent: "#0EA5E9" },
  memory: { border: "rgba(34, 197, 94, 0.6)", glow: "rgba(34, 197, 94, 0.3)", accent: "#22C55E" },
  alert: { border: "rgba(245, 158, 11, 0.6)", glow: "rgba(245, 158, 11, 0.3)", accent: "#F59E0B" },
  rate: { border: "rgba(236, 72, 153, 0.6)", glow: "rgba(236, 72, 153, 0.3)", accent: "#EC4899" },
  stat: { border: "rgba(16, 185, 129, 0.6)", glow: "rgba(16, 185, 129, 0.3)", accent: "#10B981" },
};

const ORBIT_POSITIONS = [
  { x: -200, y: -80, z: 60, rotateY: 15, scale: 1 },
  { x: 200, y: -60, z: 40, rotateY: -15, scale: 0.95 },
  { x: -180, y: 100, z: 30, rotateY: 12, scale: 0.9 },
  { x: 180, y: 80, z: 50, rotateY: -12, scale: 0.92 },
  { x: 0, y: -150, z: 70, rotateY: 0, scale: 1.05 },
  { x: -280, y: 0, z: 20, rotateY: 20, scale: 0.85 },
  { x: 280, y: 0, z: 25, rotateY: -20, scale: 0.85 },
];

function HoloCard({ card, position, index, onDismiss }: { 
  card: HoloCard; 
  position: typeof ORBIT_POSITIONS[0]; 
  index: number;
  onDismiss: (id: string) => void;
}) {
  const [phase, setPhase] = useState<"entering" | "visible" | "orbiting" | "exiting" | "done">("entering");
  const [hover, setHover] = useState(false);
  const colors = KIND_COLORS[card.kind];
  const Icon = KIND_ICONS[card.kind];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const enterDelay = (card.delay ?? index * 200) + 100;
    const orbitDelay = enterDelay + 800;
    const exitDelay = orbitDelay + 4000 + index * 500;

    const enterTimer = setTimeout(() => setPhase("visible"), enterDelay);
    const orbitTimer = setTimeout(() => setPhase("orbiting"), orbitDelay);
    const exitTimer = setTimeout(() => setPhase("exiting"), exitDelay);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onDismiss(card.id);
    }, exitDelay + 600);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(orbitTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [card.id, card.delay, index, onDismiss]);

  if (phase === "done") return null;

  const getTransform = () => {
    if (prefersReducedMotion) {
      return phase === "entering" || phase === "exiting" 
        ? "translate(-50%, -50%) scale(0.8)" 
        : `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${position.scale})`;
    }

    switch (phase) {
      case "entering":
        return `translate(-50%, -50%) translateZ(${position.z - 100}px) scale(0.3) rotateY(${position.rotateY + 30}deg)`;
      case "visible":
        return `translate(calc(-50% + ${position.x * 0.3}px), calc(-50% + ${position.y * 0.3}px)) translateZ(${position.z}px) scale(${position.scale * 0.9}) rotateY(${position.rotateY * 0.5}deg)`;
      case "orbiting":
        return `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) translateZ(${position.z}px) scale(${hover ? position.scale * 1.05 : position.scale}) rotateY(${position.rotateY}deg)`;
      case "exiting":
        return `translate(calc(-50% + ${position.x * 1.5}px), calc(-50% + ${position.y * 1.5}px)) translateZ(${position.z + 100}px) scale(0.2) rotateY(${position.rotateY + 60}deg)`;
      default:
        return "translate(-50%, -50%)";
    }
  };

  const getOpacity = () => {
    switch (phase) {
      case "entering": return 0;
      case "visible": return 0.85;
      case "orbiting": return hover ? 1 : 0.9;
      case "exiting": return 0;
      default: return 0;
    }
  };

  return (
    <div
      className="absolute left-1/2 top-1/2 pointer-events-auto cursor-pointer"
      style={{
        transform: getTransform(),
        opacity: getOpacity(),
        transition: prefersReducedMotion 
          ? "opacity 0.3s ease, transform 0.3s ease"
          : `opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)`,
        transformStyle: "preserve-3d",
        zIndex: hover ? 100 : 50 - index,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        setPhase("exiting");
        setTimeout(() => onDismiss(card.id), 600);
      }}
    >
      <div
        className="relative w-56 rounded-xl overflow-hidden backdrop-blur-xl"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)`,
          border: `1px solid ${colors.border}`,
          boxShadow: `
            0 0 30px ${colors.glow},
            0 0 60px ${colors.glow.replace("0.3", "0.15")},
            inset 0 1px 1px rgba(255,255,255,0.2),
            0 8px 32px rgba(0,0,0,0.1)
          `,
        }}
      >
        {/* Holographic shimmer effect */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: `linear-gradient(105deg, transparent 40%, ${colors.glow} 45%, transparent 50%)`,
            animation: prefersReducedMotion ? "none" : "holo-shimmer 3s ease-in-out infinite",
            backgroundSize: "200% 200%",
          }}
        />

        {/* Scan line effect */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`,
            }}
          />
        )}

        {/* Header */}
        <div
          className="px-3 py-2 flex items-center gap-2 border-b"
          style={{ borderColor: colors.border, background: `${colors.glow.replace("0.3", "0.1")}` }}
        >
          <span style={{ color: colors.accent }}><Icon size={14} /></span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.accent }}>
            {card.title}
          </span>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Metric display */}
          {card.metric && (
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-white/90" style={{ textShadow: `0 0 10px ${colors.glow}` }}>
                {card.metric.value}
              </span>
              {card.metric.trend && (
                <span className={`text-xs ${card.metric.trend === "up" ? "text-green-400" : card.metric.trend === "down" ? "text-red-400" : "text-gray-400"}`}>
                  {card.metric.trend === "up" ? "↑" : card.metric.trend === "down" ? "↓" : "→"} {card.metric.label}
                </span>
              )}
              {!card.metric.trend && (
                <span className="text-xs text-white/50">{card.metric.label}</span>
              )}
            </div>
          )}

          {/* Lines */}
          {card.lines.map((line, i) => (
            <p
              key={i}
              className="text-xs text-white/70 leading-relaxed"
              style={{
                opacity: 0.6 + (1 - i / card.lines.length) * 0.4,
              }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Footer glow line */}
        <div
          className="h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}

export function HoloDataCards({ cards, onCardsDismissed }: HoloDataCardsProps) {
  const [activeCards, setActiveCards] = useState<HoloCard[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newCards = cards.filter(c => !dismissedRef.current.has(c.id));
    if (newCards.length > 0) {
      setActiveCards(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const trulyNew = newCards.filter(c => !existingIds.has(c.id));
        return [...prev, ...trulyNew].slice(-7); // Max 7 cards
      });
    }
  }, [cards]);

  const handleDismiss = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setActiveCards(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => {
    if (activeCards.length === 0 && dismissedRef.current.size > 0) {
      onCardsDismissed?.();
      dismissedRef.current.clear();
    }
  }, [activeCards.length, onCardsDismissed]);

  if (activeCards.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        perspective: "1200px",
        perspectiveOrigin: "50% 50%",
      }}
    >
      <style>{`
        @keyframes holo-shimmer {
          0%, 100% { background-position: 200% 0; }
          50% { background-position: -200% 0; }
        }
      `}</style>
      
      {activeCards.map((card, index) => (
        <HoloCard
          key={card.id}
          card={card}
          position={ORBIT_POSITIONS[index % ORBIT_POSITIONS.length]}
          index={index}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

// Helper to parse structured responses into HoloCards
export function parseResponseToCards(
  response: string | Record<string, unknown>,
  artifactKind?: string
): HoloCard[] {
  const cards: HoloCard[] = [];
  const id = () => crypto.randomUUID();

  // Handle artifact kinds
  if (artifactKind) {
    const kindMap: Record<string, HoloCard["kind"]> = {
      markdown: "analysis",
      chart: "data",
      table: "data",
      json: "data",
      note: "memory",
      image: "data",
    };
    const cardKind = kindMap[artifactKind] || "analysis";

    if (typeof response === "string" && response.length > 0) {
      // Extract key data points from markdown/text
      const lines = response.split("\n").filter(l => l.trim());
      const titleLine = lines.find(l => l.startsWith("#")) || lines[0] || "Analysis";
      const contentLines = lines.filter(l => !l.startsWith("#")).slice(0, 3);

      // Look for metrics (numbers with labels)
      const metricMatch = response.match(/(\d+(?:\.\d+)?%?)\s*([\w\s]+)/);
      
      cards.push({
        id: id(),
        title: titleLine.replace(/^#+\s*/, "").slice(0, 30),
        lines: contentLines.map(l => l.slice(0, 60)),
        metric: metricMatch ? { value: metricMatch[1], label: metricMatch[2].trim().slice(0, 20) } : undefined,
        kind: cardKind,
      });
    }
  }

  // Handle object responses (tool results)
  if (typeof response === "object" && response !== null) {
    const obj = response as Record<string, unknown>;

    // Memory list
    if (Array.isArray(obj.memories)) {
      cards.push({
        id: id(),
        title: "Memories",
        lines: (obj.memories as Array<{ content: string }>).slice(0, 3).map(m => m.content.slice(0, 50)),
        metric: { value: String((obj.memories as unknown[]).length), label: "saved" },
        kind: "memory",
      });
    }

    // Knowledge base results
    if (Array.isArray(obj.results) && obj.query) {
      cards.push({
        id: id(),
        title: "Knowledge",
        lines: (obj.results as Array<{ file: string }>).slice(0, 3).map(r => r.file),
        metric: { value: String((obj.results as unknown[]).length), label: "matches" },
        kind: "search",
      });
    }

    // Web search results
    if (Array.isArray(obj.results) && (obj.results as Array<{ title?: string }>)[0]?.title) {
      cards.push({
        id: id(),
        title: "Search Results",
        lines: (obj.results as Array<{ title: string }>).slice(0, 3).map(r => r.title.slice(0, 50)),
        metric: { value: String((obj.results as unknown[]).length), label: "results" },
        kind: "search",
      });
    }

    // Checklist/1003 status
    if (obj.progress !== undefined || obj.sections) {
      const progress = obj.progress as number | undefined;
      cards.push({
        id: id(),
        title: "1003 Progress",
        lines: obj.nextSection ? [`Next: ${String(obj.nextSection).slice(0, 40)}`] : [],
        metric: { value: `${progress ?? 0}%`, label: "complete", trend: progress && progress > 50 ? "up" : "neutral" },
        kind: "stat",
      });
    }

    // Rate/financial data
    if (obj.rate !== undefined || obj.rates) {
      const rate = obj.rate ?? (obj.rates as Record<string, unknown>)?.current;
      cards.push({
        id: id(),
        title: "Rate Data",
        lines: obj.source ? [`Source: ${String(obj.source).slice(0, 40)}`] : [],
        metric: { value: String(rate), label: "rate" },
        kind: "rate",
      });
    }

    // File parse results
    if (obj.extracted || obj.text) {
      const text = String(obj.extracted || obj.text);
      cards.push({
        id: id(),
        title: "Extracted Data",
        lines: text.split("\n").filter(l => l.trim()).slice(0, 3).map(l => l.slice(0, 50)),
        metric: { value: String(text.length), label: "chars" },
        kind: "data",
      });
    }

    // Generic stats/metrics
    if (obj.total !== undefined || obj.count !== undefined) {
      cards.push({
        id: id(),
        title: String(obj.title || "Statistics"),
        lines: Object.entries(obj)
          .filter(([k]) => !["total", "count", "title"].includes(k))
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`),
        metric: { value: String(obj.total ?? obj.count), label: "total" },
        kind: "stat",
      });
    }

    // Vault items
    if (Array.isArray(obj.items) && (obj.items as Array<{category?: string}>)[0]?.category) {
      cards.push({
        id: id(),
        title: "Secure Vault",
        lines: (obj.items as Array<{title: string}>).slice(0, 3).map(i => i.title.slice(0, 40)),
        metric: { value: String((obj.items as unknown[]).length), label: "items" },
        kind: "memory",
      });
    }

    // Daily briefing sections
    if (Array.isArray(obj.sections) && (obj.sections as Array<{title?: string}>)[0]?.title) {
      cards.push({
        id: id(),
        title: "Daily Briefing",
        lines: (obj.sections as Array<{title: string}>).slice(0, 3).map(s => s.title),
        kind: "analysis",
      });
    }

    // Report generation
    if (obj.reportType || obj.savedPath) {
      cards.push({
        id: id(),
        title: String(obj.reportType || "Report").replace(/_/g, " "),
        lines: obj.savedPath ? [`Saved to: ${String(obj.savedPath).split("/").pop()}`] : [],
        kind: "data",
      });
    }

    // Negotiation strategies
    if (obj.scenario && obj.strategy) {
      const strategy = obj.strategy as { title: string; talking_points?: string[] };
      cards.push({
        id: id(),
        title: strategy.title || "Negotiation",
        lines: (strategy.talking_points || []).slice(0, 2).map(p => p.replace(/\*\*/g, "").slice(0, 50)),
        kind: "analysis",
      });
    }

    // Decision analysis
    if (obj.stats && typeof (obj.stats as Record<string, unknown>).total === "number") {
      const stats = obj.stats as { total: number; withOutcomes: number; positiveRate: number };
      cards.push({
        id: id(),
        title: "Decision Analysis",
        lines: [`${stats.withOutcomes} with outcomes`, `${stats.positiveRate}% positive`],
        metric: { value: String(stats.total), label: "decisions" },
        kind: "stat",
      });
    }

    // Checklist with form type
    if (obj.form && obj.progress !== undefined) {
      const formName = obj.form === "1008" ? "1008 Transmittal" : "1003 URLA";
      cards.push({
        id: id(),
        title: formName,
        lines: Array.isArray(obj.sections) 
          ? (obj.sections as Array<{name: string}>).slice(0, 2).map(s => s.name)
          : [],
        metric: { value: `${obj.progress}%`, label: "complete", trend: (obj.progress as number) > 50 ? "up" : "neutral" },
        kind: "stat",
      });
    }

    // Connector status
    if (Array.isArray(obj.connectors)) {
      const enabled = (obj.connectors as Array<{enabled: boolean}>).filter(c => c.enabled).length;
      cards.push({
        id: id(),
        title: "Connectors",
        lines: (obj.connectors as Array<{name: string; enabled: boolean}>)
          .filter(c => c.enabled)
          .slice(0, 3)
          .map(c => c.name),
        metric: { value: String(enabled), label: "active" },
        kind: "data",
      });
    }
  }

  return cards;
}

export default HoloDataCards;
