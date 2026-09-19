/**
 * Luna Voice Phase 2 Advanced Tools
 * Daily Briefing, Secure Vault, Scheduled Reports, Negotiation Coach, Decision Learning
 */

const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const os = require("node:os");

let safeStorage = null;
try {
  const { safeStorage: ss } = require("electron");
  safeStorage = ss;
} catch {
  // Not in Electron context
}

const dataDir = path.join(process.cwd(), "data");
const vaultDir = path.join(dataDir, "vault");
const vaultIndexPath = path.join(vaultDir, "index.json");
const vaultAuditPath = path.join(vaultDir, "audit.json");
const decisionsPath = path.join(dataDir, "decisions.json");
const schedulePath = path.join(dataDir, "schedules.json");
const reportsDir = path.join(os.homedir(), "Documents", "SmartStart");

// ============== Secure Vault ==============

async function ensureVaultDir() {
  await fs.mkdir(vaultDir, { recursive: true });
}

async function readVaultIndex() {
  await ensureVaultDir();
  try {
    const raw = await fs.readFile(vaultIndexPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { items: [] };
  }
}

async function writeVaultIndex(index) {
  await ensureVaultDir();
  await fs.writeFile(vaultIndexPath, JSON.stringify(index, null, 2));
}

async function readVaultAudit() {
  await ensureVaultDir();
  try {
    const raw = await fs.readFile(vaultAuditPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

async function appendAuditLog(action, itemId, details = {}) {
  const audit = await readVaultAudit();
  audit.entries.unshift({
    id: crypto.randomUUID(),
    action,
    itemId,
    details,
    timestamp: new Date().toISOString(),
  });
  // Keep last 500 entries
  audit.entries = audit.entries.slice(0, 500);
  await fs.writeFile(vaultAuditPath, JSON.stringify(audit, null, 2));
}

function encryptContent(content) {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(content);
    return { encrypted: true, data: encrypted.toString("base64") };
  }
  // Fallback: base64 only (not secure, but functional)
  return { encrypted: false, data: Buffer.from(content).toString("base64") };
}

function decryptContent(stored) {
  if (stored.encrypted && safeStorage && safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(stored.data, "base64");
    return safeStorage.decryptString(buffer);
  }
  return Buffer.from(stored.data, "base64").toString("utf8");
}

async function vaultStore(args) {
  const content = String(args.content || "");
  const title = String(args.title || "Untitled");
  const category = String(args.category || "general");
  const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];

  const index = await readVaultIndex();
  const itemId = crypto.randomUUID();
  const encrypted = encryptContent(content);
  
  // Store encrypted content in separate file
  const contentPath = path.join(vaultDir, `${itemId}.enc`);
  await fs.writeFile(contentPath, JSON.stringify(encrypted));

  index.items.unshift({
    id: itemId,
    title,
    category,
    tags,
    preview: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
    encrypted: encrypted.encrypted,
    createdAt: new Date().toISOString(),
  });
  await writeVaultIndex(index);
  await appendAuditLog("store", itemId, { title, category });

  return {
    ok: true,
    itemId,
    artifact: {
      title: "Vault: Item Stored",
      kind: "markdown",
      content: `## Stored in Secure Vault\n\n**Title:** ${title}\n**Category:** ${category}\n**Encrypted:** ${encrypted.encrypted ? "Yes (OS keychain)" : "No (base64 only)"}\n\n*Item ID: ${itemId}*`,
    },
  };
}

async function vaultRetrieve(args) {
  const itemId = String(args.itemId || "");
  const index = await readVaultIndex();
  const item = index.items.find((i) => i.id === itemId);
  
  if (!item) {
    return { ok: false, error: "Item not found in vault." };
  }

  const contentPath = path.join(vaultDir, `${itemId}.enc`);
  try {
    const raw = await fs.readFile(contentPath, "utf8");
    const stored = JSON.parse(raw);
    const content = decryptContent(stored);
    await appendAuditLog("retrieve", itemId, { title: item.title });

    return {
      ok: true,
      item: { ...item, content },
      artifact: {
        title: `Vault: ${item.title}`,
        kind: "markdown",
        content: `## ${item.title}\n\n**Category:** ${item.category}\n**Tags:** ${item.tags.join(", ") || "none"}\n\n---\n\n${content}`,
      },
    };
  } catch {
    return { ok: false, error: "Failed to decrypt vault item." };
  }
}

async function vaultSearch(args) {
  const query = String(args.query || "").toLowerCase();
  const category = args.category ? String(args.category).toLowerCase() : null;
  const index = await readVaultIndex();

  const results = index.items.filter((item) => {
    if (category && item.category.toLowerCase() !== category) return false;
    if (!query) return true;
    return (
      item.title.toLowerCase().includes(query) ||
      item.preview.toLowerCase().includes(query) ||
      item.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  await appendAuditLog("search", null, { query, category, resultsCount: results.length });

  const content = results.length > 0
    ? results.slice(0, 10).map((item) => 
        `### ${item.title}\n- **Category:** ${item.category}\n- **Preview:** ${item.preview}\n- **ID:** \`${item.id}\``
      ).join("\n\n")
    : "No items found matching your search.";

  return {
    ok: true,
    results: results.slice(0, 10),
    artifact: {
      title: `Vault Search: ${query || "all"}`,
      kind: "markdown",
      content: `## Vault Search Results\n\n${content}`,
    },
  };
}

async function vaultList(args) {
  const limit = Math.min(20, Number(args.limit) || 10);
  const index = await readVaultIndex();
  const items = index.items.slice(0, limit);

  const content = items.length > 0
    ? items.map((item) => `- **${item.title}** (${item.category}) - ${item.createdAt.split("T")[0]}`).join("\n")
    : "Vault is empty.";

  return {
    ok: true,
    items,
    artifact: {
      title: "Secure Vault",
      kind: "markdown",
      content: `## Secure Vault (${index.items.length} items)\n\n${content}`,
    },
  };
}

async function vaultDelete(args) {
  if (args.confirmed !== true) {
    return { ok: false, requiresConfirmation: true, message: "Confirm deletion of this vault item?" };
  }

  const itemId = String(args.itemId || "");
  const index = await readVaultIndex();
  const item = index.items.find((i) => i.id === itemId);
  
  if (!item) {
    return { ok: false, error: "Item not found." };
  }

  index.items = index.items.filter((i) => i.id !== itemId);
  await writeVaultIndex(index);

  try {
    await fs.unlink(path.join(vaultDir, `${itemId}.enc`));
  } catch { /* ignore */ }

  await appendAuditLog("delete", itemId, { title: item.title });

  return {
    ok: true,
    message: `Deleted "${item.title}" from vault.`,
  };
}

async function vaultAuditLog(args) {
  const limit = Math.min(50, Number(args.limit) || 20);
  const audit = await readVaultAudit();
  const entries = audit.entries.slice(0, limit);

  const content = entries.length > 0
    ? entries.map((e) => `- **${e.action}** - ${e.details.title || e.itemId || "N/A"} - ${new Date(e.timestamp).toLocaleString()}`).join("\n")
    : "No audit entries.";

  return {
    ok: true,
    entries,
    artifact: {
      title: "Vault Audit Log",
      kind: "markdown",
      content: `## Vault Audit Log\n\n${content}`,
    },
  };
}

// ============== Daily Briefing ==============

async function dailyBriefing(args) {
  const sections = [];

  // Market rates (stub - would integrate with real API)
  sections.push({
    title: "Market Rates",
    content: `**30-Year Fixed:** ~6.87% (verify with Freddie Mac)\n**15-Year Fixed:** ~6.12%\n**5/1 ARM:** ~6.24%\n\n*Rates as of market close. Check bankrate.com or freddiemac.com for live data.*`,
  });

  // Pipeline summary (stub - would pull from LOS integration)
  sections.push({
    title: "Pipeline Summary",
    content: `**Status:** No live LOS connected\n\n*Connect Encompass or your LOS to see real pipeline data.*\n\nTo enable: Settings → Connectors → Encompass`,
  });

  // Compliance deadlines (educational)
  const today = new Date();
  const month = today.getMonth();
  const complianceItems = [];
  
  if (month === 0) complianceItems.push("- **Jan 1**: NMLS renewal deadline (most states)");
  if (month === 2) complianceItems.push("- **Mar 1**: HMDA annual filing deadline");
  if (month === 3) complianceItems.push("- **Q1 QC**: Quarterly QC review recommended");
  if (month === 6) complianceItems.push("- **Q2 QC**: Mid-year compliance review");
  if (month === 8) complianceItems.push("- **Sep**: Start NMLS renewal prep");
  if (month === 11) complianceItems.push("- **Dec 31**: CE completion deadline");
  
  if (complianceItems.length === 0) {
    complianceItems.push("- No major deadlines this month");
  }
  complianceItems.push("- *Always verify with your compliance officer*");

  sections.push({
    title: "Compliance Calendar",
    content: complianceItems.join("\n"),
  });

  // News stub
  sections.push({
    title: "Industry News",
    content: `*Use web_search to find current mortgage industry news.*\n\nSuggested searches:\n- "CFPB mortgage news today"\n- "Fed interest rate decision"\n- "FHFA conforming loan limits"`,
  });

  const briefingContent = sections.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");

  return {
    ok: true,
    sections,
    artifact: {
      title: `Daily Briefing - ${today.toLocaleDateString()}`,
      kind: "markdown",
      content: `# Daily Briefing\n\n*${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}*\n\n---\n\n${briefingContent}`,
    },
  };
}

// ============== Scheduled Reports ==============

async function ensureReportsDir() {
  await fs.mkdir(reportsDir, { recursive: true });
}

async function readSchedules() {
  try {
    const raw = await fs.readFile(schedulePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { schedules: [] };
  }
}

async function writeSchedules(data) {
  await fs.writeFile(schedulePath, JSON.stringify(data, null, 2));
}

async function reportGenerate(args) {
  const reportType = String(args.type || "pipeline");
  const format = String(args.format || "markdown");
  const save = args.save !== false;

  await ensureReportsDir();
  const timestamp = new Date().toISOString().split("T")[0];
  let content = "";
  let title = "";

  switch (reportType) {
    case "pipeline":
      title = `Pipeline Report - ${timestamp}`;
      content = `# Pipeline Report\n\n**Generated:** ${new Date().toLocaleString()}\n\n## Summary\n\n*No live LOS connected. This is a template.*\n\n| Stage | Count | Volume |\n|-------|-------|--------|\n| Applications | - | - |\n| Processing | - | - |\n| Underwriting | - | - |\n| Clear to Close | - | - |\n| Funded MTD | - | - |\n\n## Action Items\n\n- Connect LOS (Encompass/Calyx) for live data\n- Review pending conditions\n- Check rate lock expirations\n\n---\n*Connect your LOS in Settings → Connectors for live pipeline data.*`;
      break;

    case "compliance":
      title = `Compliance Report - ${timestamp}`;
      content = `# Compliance Report\n\n**Generated:** ${new Date().toLocaleString()}\n\n## HMDA Status\n\n- LAR entries: Verify in your LOS\n- Data quality: Run HMDA check tool\n- Filing deadline: March 1 (annual)\n\n## QC Sampling\n\n*Monthly QC sampling should cover:*\n- 10% of funded loans (min)\n- All early payment defaults\n- Random selection across loan officers\n\n## Training & CE\n\n- MLO CE due: December 31\n- Track completion in NMLS\n\n## Open Items\n\n- [ ] Monthly QC review\n- [ ] HMDA data validation\n- [ ] Policy manual update review\n\n---\n*This is a template. Customize based on your compliance program.*`;
      break;

    case "board":
      title = `Board Report - ${timestamp}`;
      content = `# Board Report\n\n**Period:** ${timestamp}\n**Generated:** ${new Date().toLocaleString()}\n\n## Executive Summary\n\n*Connect LOS and financial systems for automated data.*\n\n## Production Metrics\n\n| Metric | Current | Prior | Change |\n|--------|---------|-------|--------|\n| Funded Volume | - | - | - |\n| Funded Units | - | - | - |\n| Pull-Through | - | - | - |\n| Avg Loan Size | - | - | - |\n\n## Financial Highlights\n\n- Revenue: Connect accounting system\n- Margin: Connect pricing engine\n- Expenses: Connect accounting system\n\n## Compliance & Risk\n\n- Regulatory status: Current\n- Open audit items: Review with compliance\n- Insurance: Verify E&O and fidelity coverage\n\n## Strategic Initiatives\n\n- [ ] Technology integrations\n- [ ] Market expansion\n- [ ] Staff development\n\n---\n*Template report. Populate with actual data before board presentation.*`;
      break;

    default:
      return { ok: false, error: `Unknown report type: ${reportType}` };
  }

  let savedPath = null;
  if (save) {
    const fileName = `${reportType}-report-${timestamp}.md`;
    savedPath = path.join(reportsDir, fileName);
    await fs.writeFile(savedPath, content);
  }

  return {
    ok: true,
    reportType,
    savedPath,
    artifact: {
      title,
      kind: "markdown",
      content: content + (savedPath ? `\n\n---\n*Saved to: ${savedPath}*` : ""),
    },
  };
}

async function reportSchedule(args) {
  const reportType = String(args.type || "pipeline");
  const frequency = String(args.frequency || "weekly");
  const enabled = args.enabled !== false;

  const schedules = await readSchedules();
  const existing = schedules.schedules.find((s) => s.type === reportType);

  if (existing) {
    existing.frequency = frequency;
    existing.enabled = enabled;
    existing.updatedAt = new Date().toISOString();
  } else {
    schedules.schedules.push({
      id: crypto.randomUUID(),
      type: reportType,
      frequency,
      enabled,
      createdAt: new Date().toISOString(),
    });
  }

  await writeSchedules(schedules);

  return {
    ok: true,
    schedule: { type: reportType, frequency, enabled },
    artifact: {
      title: "Report Schedule Updated",
      kind: "markdown",
      content: `## Report Schedule\n\n**Type:** ${reportType}\n**Frequency:** ${frequency}\n**Enabled:** ${enabled ? "Yes" : "No"}\n\n*Note: Automatic execution requires the app to be running. Check schedules with report_list_schedules.*`,
    },
  };
}

async function reportListSchedules() {
  const schedules = await readSchedules();
  
  const content = schedules.schedules.length > 0
    ? schedules.schedules.map((s) => `- **${s.type}**: ${s.frequency} (${s.enabled ? "enabled" : "disabled"})`).join("\n")
    : "No scheduled reports configured.";

  return {
    ok: true,
    schedules: schedules.schedules,
    artifact: {
      title: "Scheduled Reports",
      kind: "markdown",
      content: `## Scheduled Reports\n\n${content}\n\n*Reports are saved to: ${reportsDir}*`,
    },
  };
}

async function reportSendEmail(args) {
  // STUB: Would integrate with Gmail connector
  if (args.confirmed !== true) {
    return {
      ok: false,
      requiresConfirmation: true,
      message: `Send ${args.reportType || "report"} via email to ${args.recipient || "configured recipients"}?`,
    };
  }

  return {
    ok: false,
    stub: true,
    error: "Email sending requires Gmail connector to be configured and authenticated. Go to Settings → Connectors → Gmail.",
    artifact: {
      title: "Email Send - Stub",
      kind: "markdown",
      content: `## Email Sending Not Configured\n\nTo enable email reports:\n\n1. Go to **Settings** → **Connectors**\n2. Enable **Gmail** connector\n3. Add Google OAuth credentials\n4. Authenticate with your Google account\n\n*This is a stub implementation.*`,
    },
  };
}

// ============== Negotiation Coach ==============

async function negotiationCoach(args) {
  const scenario = String(args.scenario || "rate_objection").toLowerCase();
  const context = String(args.context || "");

  const strategies = {
    rate_objection: {
      title: "Rate Objection Handling",
      talking_points: [
        "**Acknowledge the concern**: 'I understand rate is important to you.'",
        "**Compare total cost**: Show monthly payment difference vs. competitor",
        "**Highlight service value**: Faster closing, local processing, communication",
        "**Offer alternatives**: Points buy-down, ARM consideration, rate lock extension",
        "**Create urgency**: 'Rates have been volatile; locking now provides certainty.'",
      ],
      objection_responses: [
        "**'Your rate is too high'** → 'Let me show you the total cost comparison including fees. Sometimes a lower rate comes with higher closing costs.'",
        "**'I got a better quote'** → 'I'd be happy to review that quote with you. Often quotes don't include all fees or have different assumptions.'",
        "**'I'll wait for rates to drop'** → 'I understand. Keep in mind that timing the market is difficult, and you might miss your target home.'",
      ],
    },
    fee_negotiation: {
      title: "Fee Negotiation",
      talking_points: [
        "**Know your limits**: Understand which fees are negotiable vs. fixed",
        "**Bundle value**: Offer to waive smaller fees if they commit",
        "**Explain third-party fees**: Title, appraisal, credit report are often fixed",
        "**Highlight credits**: Lender credits, seller concessions, first-time buyer programs",
      ],
      objection_responses: [
        "**'Your fees are too high'** → 'Let me break down each fee. Some are third-party costs we don't control, but let's see where we have flexibility.'",
        "**'Can you match this competitor?'** → 'I can review our pricing. If we're close, consider our service and track record as part of the value.'",
      ],
    },
    closing_timeline: {
      title: "Closing Timeline Negotiation",
      talking_points: [
        "**Set realistic expectations**: Standard is 30-45 days; faster requires cooperation",
        "**Identify bottlenecks**: Appraisal, title, borrower documents",
        "**Offer rush options**: Express processing, weekend closings (if available)",
        "**Communicate proactively**: Daily updates reduce anxiety",
      ],
      objection_responses: [
        "**'I need to close in 2 weeks'** → 'That's aggressive but possible with perfect conditions. Let's discuss what we'd need from you to make it happen.'",
        "**'Why is it taking so long?'** → 'Let me check our pipeline and give you a specific status. Usually delays are appraisal or title-related.'",
      ],
    },
    competitor_comparison: {
      title: "Competitor Comparison",
      talking_points: [
        "**Don't disparage competitors**: Focus on your strengths",
        "**Ask questions**: 'What did you like about their offer?'",
        "**Differentiate on service**: Response time, local vs. national, track record",
        "**Highlight risk**: Online lenders may have communication issues at closing",
      ],
      objection_responses: [
        "**'Big Bank offered better terms'** → 'Big banks are great for some borrowers. Consider whether you'll have a dedicated contact or be transferred between departments.'",
        "**'Online lender is cheaper'** → 'Online lenders can be efficient. Have you confirmed their fees, lock policy, and what happens if there's an issue at closing?'",
      ],
    },
  };

  const strategy = strategies[scenario] || strategies.rate_objection;

  const content = `## ${strategy.title}\n\n### Key Talking Points\n\n${strategy.talking_points.join("\n\n")}\n\n### Objection Responses\n\n${strategy.objection_responses.join("\n\n")}\n\n---\n\n${context ? `**Your Context:** ${context}\n\n` : ""}*Adapt these strategies to your specific situation and borrower. Always be honest and compliant.*`;

  return {
    ok: true,
    scenario,
    strategy,
    artifact: {
      title: `Negotiation Coach: ${strategy.title}`,
      kind: "markdown",
      content,
    },
  };
}

async function negotiationTalkingPoints(args) {
  const topic = String(args.topic || "general");
  
  const points = {
    value_proposition: [
      "Local expertise and market knowledge",
      "Dedicated loan officer (single point of contact)",
      "Faster communication and problem resolution",
      "Flexible underwriting within guidelines",
      "Track record of on-time closings",
    ],
    rate_justification: [
      "Total cost of loan matters more than rate alone",
      "Lower fees can offset slightly higher rate",
      "Service value: avoiding delays saves money",
      "Rate locks provide certainty in volatile markets",
      "Consider lifetime cost vs. monthly payment focus",
    ],
    objection_prevention: [
      "Set expectations early on timeline and process",
      "Explain all fees upfront (LE transparency)",
      "Discuss rate lock strategy before it becomes an issue",
      "Provide regular status updates proactively",
      "Address competitor quotes before borrower shops",
    ],
  };

  const topicPoints = points[topic] || points.value_proposition;

  return {
    ok: true,
    topic,
    points: topicPoints,
    artifact: {
      title: `Talking Points: ${topic.replace(/_/g, " ")}`,
      kind: "markdown",
      content: `## Talking Points: ${topic.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}\n\n${topicPoints.map((p) => `- ${p}`).join("\n")}\n\n---\n*Customize these points for your specific situation.*`,
    },
  };
}

// ============== Decision Learning Loop ==============

async function readDecisions() {
  try {
    const raw = await fs.readFile(decisionsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { decisions: [], patterns: [] };
  }
}

async function writeDecisions(data) {
  await fs.writeFile(decisionsPath, JSON.stringify(data, null, 2));
}

async function decisionLog(args) {
  const decision = String(args.decision || "");
  const reasoning = String(args.reasoning || "");
  const category = String(args.category || "general");
  const outcome = args.outcome; // optional - can be set later

  const data = await readDecisions();
  const entry = {
    id: crypto.randomUUID(),
    decision,
    reasoning,
    category,
    outcome: outcome || null,
    createdAt: new Date().toISOString(),
  };
  data.decisions.unshift(entry);
  
  // Keep last 200 decisions
  data.decisions = data.decisions.slice(0, 200);
  await writeDecisions(data);

  return {
    ok: true,
    entry,
    artifact: {
      title: "Decision Logged",
      kind: "markdown",
      content: `## Decision Logged\n\n**Decision:** ${decision}\n\n**Reasoning:** ${reasoning}\n\n**Category:** ${category}\n\n*ID: ${entry.id}*\n\n---\n*Update the outcome later with decision_update_outcome.*`,
    },
  };
}

async function decisionUpdateOutcome(args) {
  const decisionId = String(args.decisionId || "");
  const outcome = String(args.outcome || "");
  const notes = String(args.notes || "");

  const data = await readDecisions();
  const entry = data.decisions.find((d) => d.id === decisionId);
  
  if (!entry) {
    return { ok: false, error: "Decision not found." };
  }

  entry.outcome = outcome;
  entry.outcomeNotes = notes;
  entry.outcomeAt = new Date().toISOString();
  await writeDecisions(data);

  return {
    ok: true,
    entry,
    message: `Updated outcome for decision: ${entry.decision.slice(0, 50)}...`,
  };
}

async function decisionAnalyze(args) {
  const category = args.category ? String(args.category) : null;
  const data = await readDecisions();

  let decisions = data.decisions;
  if (category) {
    decisions = decisions.filter((d) => d.category.toLowerCase() === category.toLowerCase());
  }

  const withOutcomes = decisions.filter((d) => d.outcome);
  const positiveOutcomes = withOutcomes.filter((d) => 
    d.outcome.toLowerCase().includes("success") || 
    d.outcome.toLowerCase().includes("positive") ||
    d.outcome.toLowerCase().includes("good")
  );

  const categories = {};
  for (const d of decisions) {
    categories[d.category] = (categories[d.category] || 0) + 1;
  }

  const recentDecisions = decisions.slice(0, 5).map((d) => 
    `- **${d.decision.slice(0, 60)}...** (${d.category}) - ${d.outcome || "outcome pending"}`
  ).join("\n");

  const categoryBreakdown = Object.entries(categories)
    .map(([cat, count]) => `- ${cat}: ${count}`)
    .join("\n");

  return {
    ok: true,
    stats: {
      total: decisions.length,
      withOutcomes: withOutcomes.length,
      positiveRate: withOutcomes.length > 0 ? Math.round((positiveOutcomes.length / withOutcomes.length) * 100) : 0,
    },
    artifact: {
      title: "Decision Analysis",
      kind: "markdown",
      content: `## Decision Analysis\n\n**Total Decisions:** ${decisions.length}\n**With Outcomes:** ${withOutcomes.length}\n**Positive Outcome Rate:** ${withOutcomes.length > 0 ? Math.round((positiveOutcomes.length / withOutcomes.length) * 100) : "N/A"}%\n\n### By Category\n\n${categoryBreakdown}\n\n### Recent Decisions\n\n${recentDecisions || "No decisions logged yet."}\n\n---\n*Log decisions with decision_log to build your pattern history.*`,
    },
  };
}

async function decisionSuggest(args) {
  const context = String(args.context || "");
  const category = String(args.category || "general");
  const data = await readDecisions();

  // Find similar past decisions
  const similar = data.decisions.filter((d) => {
    if (d.category.toLowerCase() !== category.toLowerCase()) return false;
    if (!d.outcome) return false;
    // Simple keyword matching
    const contextWords = context.toLowerCase().split(/\s+/);
    const decisionWords = d.decision.toLowerCase().split(/\s+/);
    const overlap = contextWords.filter((w) => decisionWords.includes(w)).length;
    return overlap > 0;
  }).slice(0, 3);

  let suggestions = "";
  if (similar.length > 0) {
    suggestions = similar.map((d) => 
      `### Similar: ${d.decision.slice(0, 60)}...\n- **Outcome:** ${d.outcome}\n- **Reasoning:** ${d.reasoning}`
    ).join("\n\n");
  } else {
    suggestions = "*No similar past decisions found. This will improve as you log more decisions.*";
  }

  return {
    ok: true,
    similar,
    artifact: {
      title: "Decision Suggestions",
      kind: "markdown",
      content: `## Decision Suggestions\n\n**Context:** ${context}\n**Category:** ${category}\n\n---\n\n${suggestions}\n\n---\n*Suggestions are based on your logged decision history. Log outcomes to improve future suggestions.*`,
    },
  };
}

// ============== Tool Specs ==============

const advancedToolSpecs = [
  // Secure Vault
  {
    type: "function",
    name: "vault_store",
    description: "Store sensitive content in the encrypted secure vault. Uses OS keychain (Electron safeStorage) when available.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The sensitive content to store" },
        title: { type: "string", description: "Title/name for the item" },
        category: { type: "string", description: "Category (e.g., 'api_key', 'document', 'sop', 'credential')" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for searching" },
      },
      required: ["content", "title"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "vault_retrieve",
    description: "Retrieve and decrypt an item from the secure vault by ID.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The vault item ID" },
      },
      required: ["itemId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "vault_search",
    description: "Search the secure vault by query and/or category.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", description: "Filter by category" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "vault_list",
    description: "List items in the secure vault.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "vault_delete",
    description: "Delete an item from the secure vault. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The vault item ID" },
        confirmed: { type: "boolean" },
      },
      required: ["itemId", "confirmed"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "vault_audit",
    description: "View the vault access audit log.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  // Daily Briefing
  {
    type: "function",
    name: "daily_briefing",
    description: "Get a daily briefing with market rates, pipeline summary (if LOS connected), compliance calendar, and news suggestions.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  // Scheduled Reports
  {
    type: "function",
    name: "report_generate",
    description: "Generate a report (pipeline, compliance, or board). Saves to Documents/SmartStart by default.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["pipeline", "compliance", "board"], description: "Report type" },
        format: { type: "string", enum: ["markdown", "html"], description: "Output format" },
        save: { type: "boolean", description: "Save to Documents/SmartStart" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "report_schedule",
    description: "Schedule automatic report generation.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["pipeline", "compliance", "board"] },
        frequency: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly"] },
        enabled: { type: "boolean" },
      },
      required: ["type", "frequency"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "report_list_schedules",
    description: "List all scheduled reports.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "report_send_email",
    description: "Send a report via email (requires Gmail connector). Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        reportType: { type: "string" },
        recipient: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["reportType", "confirmed"],
      additionalProperties: false,
    },
  },
  // Negotiation Coach
  {
    type: "function",
    name: "negotiation_coach",
    description: "Get negotiation strategies, talking points, and objection responses for common lending scenarios.",
    parameters: {
      type: "object",
      properties: {
        scenario: { type: "string", enum: ["rate_objection", "fee_negotiation", "closing_timeline", "competitor_comparison"], description: "The negotiation scenario" },
        context: { type: "string", description: "Additional context about your specific situation" },
      },
      required: ["scenario"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "negotiation_talking_points",
    description: "Get talking points for a specific topic.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", enum: ["value_proposition", "rate_justification", "objection_prevention"] },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  // Decision Learning
  {
    type: "function",
    name: "decision_log",
    description: "Log a decision with reasoning for learning and pattern analysis.",
    parameters: {
      type: "object",
      properties: {
        decision: { type: "string", description: "The decision made" },
        reasoning: { type: "string", description: "Why this decision was made" },
        category: { type: "string", description: "Category (e.g., 'pricing', 'underwriting', 'hiring', 'marketing')" },
        outcome: { type: "string", description: "Optional immediate outcome" },
      },
      required: ["decision", "reasoning"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "decision_update_outcome",
    description: "Update the outcome of a previously logged decision.",
    parameters: {
      type: "object",
      properties: {
        decisionId: { type: "string", description: "The decision ID" },
        outcome: { type: "string", description: "The outcome (success/failure/mixed)" },
        notes: { type: "string", description: "Additional notes" },
      },
      required: ["decisionId", "outcome"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "decision_analyze",
    description: "Analyze logged decisions to find patterns and success rates.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "decision_suggest",
    description: "Get suggestions based on similar past decisions and their outcomes.",
    parameters: {
      type: "object",
      properties: {
        context: { type: "string", description: "The current situation/decision to make" },
        category: { type: "string", description: "Category of the decision" },
      },
      required: ["context"],
      additionalProperties: false,
    },
  },
];

// ============== Handler ==============

async function handleAdvancedTool(name, args) {
  switch (name) {
    // Vault
    case "vault_store":
      return await vaultStore(args);
    case "vault_retrieve":
      return await vaultRetrieve(args);
    case "vault_search":
      return await vaultSearch(args);
    case "vault_list":
      return await vaultList(args);
    case "vault_delete":
      return await vaultDelete(args);
    case "vault_audit":
      return await vaultAuditLog(args);
    // Daily Briefing
    case "daily_briefing":
      return await dailyBriefing(args);
    // Reports
    case "report_generate":
      return await reportGenerate(args);
    case "report_schedule":
      return await reportSchedule(args);
    case "report_list_schedules":
      return await reportListSchedules();
    case "report_send_email":
      return await reportSendEmail(args);
    // Negotiation
    case "negotiation_coach":
      return await negotiationCoach(args);
    case "negotiation_talking_points":
      return await negotiationTalkingPoints(args);
    // Decision Learning
    case "decision_log":
      return await decisionLog(args);
    case "decision_update_outcome":
      return await decisionUpdateOutcome(args);
    case "decision_analyze":
      return await decisionAnalyze(args);
    case "decision_suggest":
      return await decisionSuggest(args);
    default:
      return null;
  }
}

module.exports = {
  advancedToolSpecs,
  handleAdvancedTool,
};
