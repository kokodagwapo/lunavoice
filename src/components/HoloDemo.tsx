import { useState, useCallback } from "react";
import { Sparkles, Building2, DollarSign, Activity, X } from "lucide-react";
import { HoloDataCards, type HoloCard } from "./HoloDataCards";
import SingularityHorizon, { DEFAULT_SINGULARITY_STATES } from "./ui/singularity-horizon";

// Sample data payloads for demo
const DEMO_SCENARIOS: Record<string, { question: string; cards: Omit<HoloCard, "id">[] }> = {
  hmda: {
    question: "What was the performance of this lender in 2024 based on HMDA data?",
    cards: [
      {
        title: "Total Originations",
        lines: ["Home purchase loans: 2,847", "Refinance: 1,234", "YoY growth: +12.3%"],
        metric: { value: "4,081", label: "loans closed", trend: "up" },
        kind: "stat",
      },
      {
        title: "Denial Rate",
        lines: ["Industry avg: 14.2%", "Peer group: 11.8%", "Top quartile threshold: 9.5%"],
        metric: { value: "8.7%", label: "vs 14.2% industry", trend: "down" },
        kind: "data",
      },
      {
        title: "Market Share",
        lines: ["Metro area rank: #3", "Up from #5 in 2023", "Gap to leader: 2.1%"],
        metric: { value: "12.4%", label: "metro area", trend: "up" },
        kind: "analysis",
      },
      {
        title: "Compliance Score",
        lines: ["Fair lending: Pass", "HMDA accuracy: 99.2%", "No enforcement actions"],
        metric: { value: "A+", label: "rating" },
        kind: "stat",
      },
      {
        title: "Processing Time",
        lines: ["Application to close: 32 days", "Industry median: 45 days", "Improvement: -8 days YoY"],
        metric: { value: "32d", label: "avg close time", trend: "down" },
        kind: "data",
      },
    ],
  },
  rates: {
    question: "Compare current mortgage rates across loan types",
    cards: [
      {
        title: "30-Year Fixed",
        lines: ["Freddie Mac survey", "Down 0.125% this week", "52-week range: 6.12% – 7.79%"],
        metric: { value: "6.87%", label: "national avg", trend: "down" },
        kind: "rate",
      },
      {
        title: "15-Year Fixed",
        lines: ["Lower rate, higher payment", "Popular for refinance", "Savings vs 30yr: $127K"],
        metric: { value: "6.12%", label: "national avg", trend: "down" },
        kind: "rate",
      },
      {
        title: "5/1 ARM",
        lines: ["Initial rate period: 5 years", "Rate cap: 2/2/5", "Index: SOFR + 2.75%"],
        metric: { value: "6.24%", label: "initial rate", trend: "neutral" },
        kind: "rate",
      },
      {
        title: "FHA 30-Year",
        lines: ["Min down: 3.5%", "MIP: 0.55% annual", "Credit score: 580+ eligible"],
        metric: { value: "6.42%", label: "with MIP", trend: "down" },
        kind: "rate",
      },
    ],
  },
  pipeline: {
    question: "Show me the current pipeline status",
    cards: [
      {
        title: "Active Pipeline",
        lines: ["Applications: 47", "Processing: 23", "Underwriting: 18", "Clear to close: 6"],
        metric: { value: "$18.2M", label: "total volume", trend: "up" },
        kind: "stat",
      },
      {
        title: "Conversion Rate",
        lines: ["Lead to app: 24%", "App to funded: 68%", "Target: 72%"],
        metric: { value: "68%", label: "pull-through", trend: "up" },
        kind: "data",
      },
      {
        title: "Avg Days in Stage",
        lines: ["Processing: 8 days", "UW: 4 days", "CTC to fund: 12 days"],
        metric: { value: "24d", label: "total cycle", trend: "down" },
        kind: "analysis",
      },
      {
        title: "This Week",
        lines: ["Funded: 8 loans", "Revenue: $142K", "vs last week: +23%"],
        metric: { value: "8", label: "closings", trend: "up" },
        kind: "stat",
      },
      {
        title: "Alerts",
        lines: ["3 loans expiring locks", "2 pending conditions", "1 appraisal delay"],
        metric: { value: "6", label: "action items" },
        kind: "alert",
      },
    ],
  },
};

type HoloDemoProps = {
  onClose?: () => void;
  embedded?: boolean;
};

export function HoloDemo({ onClose, embedded = false }: HoloDemoProps) {
  const [activeCards, setActiveCards] = useState<HoloCard[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerScenario = useCallback((key: string) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    setSelectedScenario(key);
    setActiveCards([]); // Clear existing
    
    // Add cards with staggered delays
    setTimeout(() => {
      const scenario = DEMO_SCENARIOS[key];
      const cards = scenario.cards.map((card, i) => ({
        ...card,
        id: `${key}-${i}-${Date.now()}`,
        delay: i * 300,
      }));
      setActiveCards(cards);
      setIsAnimating(false);
    }, 100);
  }, [isAnimating]);

  const handleCardsDismissed = useCallback(() => {
    setSelectedScenario(null);
  }, []);

  return (
    <div className={`${embedded ? "" : "fixed inset-0 z-50"} flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900`}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Holographic Data Visualization</h1>
              <p className="text-xs text-white/50">Click a sample question to see the effect</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {/* Main Stage */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background grid effect */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Singularity Horizon */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-72 h-72">
          <SingularityHorizon 
            width="100%"
            height="100%"
            particles={3000}
            hud={false}
            interactive={true}
            autoRotate={true}
            state={DEFAULT_SINGULARITY_STATES[isAnimating ? 2 : activeCards.length > 0 ? 1 : 0]}
            style={{ borderRadius: "50%", background: "transparent" }}
          />
        </div>

        {/* Holographic Cards Overlay */}
        <HoloDataCards 
          cards={activeCards} 
          onCardsDismissed={handleCardsDismissed}
        />

        {/* Active question display */}
        {selectedScenario && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 max-w-xl px-6 py-3 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white/90 text-sm text-center">
            "{DEMO_SCENARIOS[selectedScenario].question}"
          </div>
        )}
      </div>

      {/* Sample Questions Panel */}
      <div className="p-6 bg-black/30 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-4 text-center">
            Click a sample question to trigger holographic visualization
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => triggerScenario("hmda")}
              disabled={isAnimating}
              className={`group p-4 rounded-2xl text-left transition-all ${
                selectedScenario === "hmda" 
                  ? "bg-blue-500/30 border-blue-400/50" 
                  : "bg-white/5 hover:bg-white/10 border-white/10"
              } border backdrop-blur-sm disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedScenario === "hmda" ? "bg-blue-500/50" : "bg-white/10 group-hover:bg-white/20"
                } transition-all`}>
                  <Building2 size={18} className="text-blue-300" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">HMDA Performance</h3>
                  <p className="text-xs text-white/50">Lender metrics, denial rates, market share</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => triggerScenario("rates")}
              disabled={isAnimating}
              className={`group p-4 rounded-2xl text-left transition-all ${
                selectedScenario === "rates" 
                  ? "bg-emerald-500/30 border-emerald-400/50" 
                  : "bg-white/5 hover:bg-white/10 border-white/10"
              } border backdrop-blur-sm disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedScenario === "rates" ? "bg-emerald-500/50" : "bg-white/10 group-hover:bg-white/20"
                } transition-all`}>
                  <DollarSign size={18} className="text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Rate Comparison</h3>
                  <p className="text-xs text-white/50">Current rates by loan type</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => triggerScenario("pipeline")}
              disabled={isAnimating}
              className={`group p-4 rounded-2xl text-left transition-all ${
                selectedScenario === "pipeline" 
                  ? "bg-purple-500/30 border-purple-400/50" 
                  : "bg-white/5 hover:bg-white/10 border-white/10"
              } border backdrop-blur-sm disabled:opacity-50`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedScenario === "pipeline" ? "bg-purple-500/50" : "bg-white/10 group-hover:bg-white/20"
                } transition-all`}>
                  <Activity size={18} className="text-purple-300" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white mb-1">Pipeline Status</h3>
                  <p className="text-xs text-white/50">Volume, conversion, cycle times</p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-xs text-white/30 text-center mt-4">
            Cards will animate in, orbit briefly, then dissolve. Click any card to dismiss early.
          </p>
        </div>
      </div>
    </div>
  );
}

export default HoloDemo;
