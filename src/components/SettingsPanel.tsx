import { useEffect, useState } from "react";
import {
  X, Settings, Key, Plug, RefreshCw, Check, AlertCircle,
  Mail, Search, Brain, FileText, Building2, Globe, Sparkles, AudioWaveform, BookOpen
} from "lucide-react";
import type { ConnectorManifest, SecretInfo } from "../vite-env";

type SettingsPanelProps = {
  visible: boolean;
  onClose: () => void;
};

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Mail,
  Search,
  Brain,
  FileText,
  Building2,
  Globe,
  Sparkles,
  AudioWaveform,
  BookOpen,
};

function ConnectorIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon] || Plug;
  return <Icon size={18} className={className} />;
}

export function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"connectors" | "secrets">("connectors");
  const [connectors, setConnectors] = useState<ConnectorManifest[]>([]);
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  async function loadData() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        window.luna.listConnectors(),
        window.luna.listSecrets(),
      ]);
      setConnectors(c);
      setSecrets(s);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleConnector(id: string, enabled: boolean) {
    try {
      if (enabled) {
        await window.luna.disableConnector(id);
      } else {
        await window.luna.enableConnector(id);
      }
      await loadData();
    } catch (error) {
      console.error("Failed to toggle connector:", error);
    }
  }

  async function saveSecret() {
    if (!newSecretKey.trim() || !newSecretValue.trim()) return;
    setSaving(true);
    try {
      await window.luna.setSecret(newSecretKey.trim(), newSecretValue.trim());
      setNewSecretKey("");
      setNewSecretValue("");
      await loadData();
    } catch (error) {
      console.error("Failed to save secret:", error);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSecret(key: string) {
    if (!window.confirm(`Delete secret ${key}?`)) return;
    try {
      await window.luna.deleteSecret(key);
      await loadData();
    } catch (error) {
      console.error("Failed to delete secret:", error);
    }
  }

  if (!visible) return null;

  const groupedConnectors: Record<string, ConnectorManifest[]> = {};
  for (const c of connectors) {
    if (!groupedConnectors[c.category]) groupedConnectors[c.category] = [];
    groupedConnectors[c.category].push(c);
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[80vh] glass rounded-2xl flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-gray-600" />
            <h2 className="font-semibold text-gray-800">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 py-3 border-b border-black/5">
          <div className="flex gap-1 p-1 bg-black/5 rounded-xl">
            <button
              onClick={() => setActiveTab("connectors")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === "connectors" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Plug size={16} />
              Connectors
            </button>
            <button
              onClick={() => setActiveTab("secrets")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === "secrets" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Key size={16} />
              API Keys
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="text-gray-400 animate-spin" />
            </div>
          ) : activeTab === "connectors" ? (
            <div className="space-y-6">
              {Object.entries(groupedConnectors).map(([category, list]) => (
                <div key={category}>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {list.map((connector) => (
                      <div
                        key={connector.id}
                        className="flex items-center gap-4 p-3 rounded-xl bg-white/50 hover:bg-white/80 transition-all"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          connector.enabled ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                        }`}>
                          <ConnectorIcon icon={connector.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{connector.name}</span>
                            {connector.status === "stub" && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Stub</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{connector.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!connector.configured && connector.status === "available" && (
                            <span title="Missing API keys">
                              <AlertCircle size={16} className="text-amber-500" />
                            </span>
                          )}
                          <button
                            onClick={() => toggleConnector(connector.id, connector.enabled)}
                            className={`w-12 h-6 rounded-full transition-all ${
                              connector.enabled ? "bg-blue-500" : "bg-gray-300"
                            }`}
                            disabled={connector.status === "stub"}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              connector.enabled ? "translate-x-6" : "translate-x-0.5"
                            }`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add new secret */}
              <div className="p-4 rounded-xl bg-white/50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Add API Key</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newSecretKey}
                    onChange={(e) => setNewSecretKey(e.target.value)}
                    placeholder="Key name (e.g., OPENAI_API_KEY)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none focus:border-blue-400"
                  />
                  <input
                    type="password"
                    value={newSecretValue}
                    onChange={(e) => setNewSecretValue(e.target.value)}
                    placeholder="Secret value"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={saveSecret}
                    disabled={saving || !newSecretKey.trim() || !newSecretValue.trim()}
                    className="w-full py-2 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? <RefreshCw size={16} className="animate-spin" /> : <Key size={16} />}
                    Save Securely
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Secrets are encrypted using OS keychain where available. Never stored in plaintext.
                </p>
              </div>

              {/* Existing secrets */}
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Configured Keys ({secrets.length})
                </h3>
                {secrets.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    No API keys configured. Add keys above or set them in .env.local
                  </p>
                ) : (
                  <div className="space-y-2">
                    {secrets.map((secret) => (
                      <div
                        key={secret.key}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/50"
                      >
                        <Key size={16} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-gray-800">{secret.key}</div>
                          <div className="text-xs text-gray-400 font-mono">{secret.masked}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            secret.source === "env" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {secret.source === "env" ? "ENV" : secret.encrypted ? "Encrypted" : "Stored"}
                          </span>
                          {secret.source !== "env" && (
                            <button
                              onClick={() => deleteSecret(secret.key)}
                              className="text-red-400 hover:text-red-600"
                              title="Delete"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/5 text-xs text-gray-400 text-center">
          API keys from .env.local are auto-loaded on startup.
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
