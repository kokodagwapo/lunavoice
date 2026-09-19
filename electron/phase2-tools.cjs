/**
 * Luna Voice Phase 2 Tools
 * Memory, Knowledge Base, File Upload, OCR, Borrower Guidance
 */

const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const dataDir = path.join(process.cwd(), "data");
const memoryPath = path.join(dataDir, "luna-memory.json");
const knowledgeDir = path.join(process.cwd(), "knowledge");
const uploadsDir = path.join(dataDir, "uploads");
const checklistPath = path.join(dataDir, "1003-session.json");

// ============== Memory System ==============

async function ensureMemoryFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(memoryPath);
  } catch {
    await fs.writeFile(memoryPath, JSON.stringify({ memories: [] }, null, 2));
  }
}

async function readMemory() {
  await ensureMemoryFile();
  const raw = await fs.readFile(memoryPath, "utf8");
  const data = JSON.parse(raw);
  return Array.isArray(data.memories) ? data.memories : [];
}

async function writeMemory(memories) {
  await ensureMemoryFile();
  await fs.writeFile(memoryPath, JSON.stringify({ memories }, null, 2));
}

async function memorySave(args) {
  const memories = await readMemory();
  const memory = {
    id: crypto.randomUUID(),
    content: String(args.content || ""),
    category: String(args.category || "general"),
    tags: Array.isArray(args.tags) ? args.tags.map(String) : [],
    createdAt: new Date().toISOString(),
  };
  memories.unshift(memory);
  await writeMemory(memories);
  return {
    ok: true,
    memory,
    artifact: {
      title: "Memory Saved",
      kind: "markdown",
      content: `## Memory Saved\n\n**Category:** ${memory.category}\n\n${memory.content}\n\n*Tags: ${memory.tags.join(", ") || "none"}*`,
    },
  };
}

async function memorySearch(args) {
  const memories = await readMemory();
  const query = String(args.query || "").toLowerCase();
  const category = args.category ? String(args.category).toLowerCase() : null;
  
  const results = memories.filter((m) => {
    if (category && m.category.toLowerCase() !== category) return false;
    if (!query) return true;
    return (
      m.content.toLowerCase().includes(query) ||
      m.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  const content = results.length > 0
    ? results.slice(0, 10).map((m) => `### ${m.category}\n${m.content}\n*${new Date(m.createdAt).toLocaleDateString()}*`).join("\n\n---\n\n")
    : "No memories found matching your search.";

  return {
    ok: true,
    results: results.slice(0, 10),
    artifact: {
      title: `Memory Search: ${args.query || "all"}`,
      kind: "markdown",
      content,
    },
  };
}

async function memoryList(args) {
  const memories = await readMemory();
  const limit = Math.min(20, Number(args.limit) || 10);
  const recent = memories.slice(0, limit);

  const content = recent.length > 0
    ? recent.map((m) => `- **${m.category}**: ${m.content.slice(0, 100)}${m.content.length > 100 ? "..." : ""}`).join("\n")
    : "No memories saved yet.";

  return {
    ok: true,
    memories: recent,
    artifact: {
      title: "Recent Memories",
      kind: "markdown",
      content: `## ${recent.length} Recent Memories\n\n${content}`,
    },
  };
}

async function memoryDelete(args) {
  if (!args.confirmed) {
    return { ok: false, requiresConfirmation: true, message: "Confirm deletion of this memory?" };
  }
  const memories = await readMemory();
  const before = memories.length;
  const filtered = memories.filter((m) => m.id !== args.id);
  await writeMemory(filtered);
  return {
    ok: true,
    deleted: filtered.length < before,
    message: filtered.length < before ? "Memory deleted." : "Memory not found.",
  };
}

// ============== Knowledge Base ==============

async function loadKnowledgeFiles() {
  try {
    const files = await fs.readdir(knowledgeDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const contents = await Promise.all(
      mdFiles.map(async (f) => {
        const content = await fs.readFile(path.join(knowledgeDir, f), "utf8");
        return { file: f, content };
      })
    );
    return contents;
  } catch {
    return [];
  }
}

async function kbSearch(args) {
  const query = String(args.query || "").toLowerCase();
  const files = await loadKnowledgeFiles();
  
  const results = [];
  for (const { file, content } of files) {
    const lines = content.split("\n");
    const matches = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join("\n");
        matches.push({ line: i + 1, context });
      }
    }
    
    if (matches.length > 0) {
      results.push({
        file: file.replace(".md", "").replace(/-/g, " "),
        matches: matches.slice(0, 3),
      });
    }
  }

  if (results.length === 0) {
    return {
      ok: true,
      results: [],
      artifact: {
        title: `Knowledge Search: ${query}`,
        kind: "markdown",
        content: `## No Results\n\nNo knowledge base articles matched "${query}". Try different keywords.`,
      },
    };
  }

  const content = results.map((r) => {
    const snippets = r.matches.map((m) => m.context).join("\n\n---\n\n");
    return `### ${r.file}\n\n${snippets}`;
  }).join("\n\n---\n\n");

  return {
    ok: true,
    results,
    artifact: {
      title: `Knowledge: ${query}`,
      kind: "markdown",
      content: `## Knowledge Base Results\n\n*Found in ${results.length} article(s)*\n\n${content}\n\n---\n*Disclaimer: Educational guidance only. Consult professionals for specific advice.*`,
    },
  };
}

async function kbTopics() {
  const files = await loadKnowledgeFiles();
  const topics = files.map((f) => ({
    name: f.file.replace(".md", "").replace(/-/g, " "),
    file: f.file,
    preview: f.content.split("\n").slice(0, 5).join("\n"),
  }));

  const content = topics.length > 0
    ? topics.map((t) => `### ${t.name}\n${t.preview}`).join("\n\n---\n\n")
    : "No knowledge base articles found.";

  return {
    ok: true,
    topics,
    artifact: {
      title: "Knowledge Base Topics",
      kind: "markdown",
      content: `## Available Knowledge Topics\n\n${content}`,
    },
  };
}

// ============== File Upload & Parsing ==============

async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir, { recursive: true });
}

async function parseUploadedFile(args) {
  const filePath = String(args.filePath || "");
  const fileName = String(args.fileName || path.basename(filePath));
  const ext = path.extname(fileName).toLowerCase();

  try {
    await ensureUploadsDir();
    
    // Copy file to uploads if it's not already there
    let targetPath = filePath;
    if (!filePath.startsWith(uploadsDir)) {
      targetPath = path.join(uploadsDir, `${crypto.randomUUID()}-${fileName}`);
      await fs.copyFile(filePath, targetPath);
    }

    let extractedText = "";
    let fileType = "unknown";

    if (ext === ".csv") {
      fileType = "csv";
      const content = await fs.readFile(targetPath, "utf8");
      const Papa = require("papaparse");
      const parsed = Papa.parse(content, { header: true });
      extractedText = JSON.stringify(parsed.data.slice(0, 20), null, 2);
      if (parsed.data.length > 20) {
        extractedText += `\n\n... and ${parsed.data.length - 20} more rows`;
      }
    } else if (ext === ".xlsx" || ext === ".xls") {
      fileType = "spreadsheet";
      const XLSX = require("xlsx");
      const buffer = await fs.readFile(targetPath);
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      extractedText = data.slice(0, 20).map((row) => row.join(" | ")).join("\n");
      if (data.length > 20) {
        extractedText += `\n\n... and ${data.length - 20} more rows`;
      }
    } else if (ext === ".pdf") {
      fileType = "pdf";
      const pdfParse = require("pdf-parse");
      const buffer = await fs.readFile(targetPath);
      const data = await pdfParse(buffer);
      extractedText = data.text.slice(0, 5000);
      if (data.text.length > 5000) {
        extractedText += "\n\n... (truncated)";
      }
    } else if (ext === ".docx" || ext === ".doc") {
      fileType = "document";
      const mammoth = require("mammoth");
      const buffer = await fs.readFile(targetPath);
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value.slice(0, 5000);
      if (result.value.length > 5000) {
        extractedText += "\n\n... (truncated)";
      }
    } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      fileType = "image";
      extractedText = `[Image uploaded: ${fileName}]\nUse the ocr_extract tool to extract text from this image.`;
    } else if ([".txt", ".md", ".json"].includes(ext)) {
      fileType = "text";
      const content = await fs.readFile(targetPath, "utf8");
      extractedText = content.slice(0, 5000);
      if (content.length > 5000) {
        extractedText += "\n\n... (truncated)";
      }
    } else {
      return {
        ok: false,
        error: `Unsupported file type: ${ext}`,
      };
    }

    // Save file metadata to memory for context
    const fileRecord = {
      id: crypto.randomUUID(),
      fileName,
      filePath: targetPath,
      fileType,
      extractedText: extractedText.slice(0, 2000),
      uploadedAt: new Date().toISOString(),
    };

    return {
      ok: true,
      file: fileRecord,
      artifact: {
        title: `File: ${fileName}`,
        kind: fileType === "csv" || fileType === "spreadsheet" ? "table" : "markdown",
        content: fileType === "csv" || fileType === "spreadsheet" 
          ? extractedText
          : `## Uploaded: ${fileName}\n\n**Type:** ${fileType}\n\n### Content Preview\n\n\`\`\`\n${extractedText}\n\`\`\``,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============== OCR ==============

async function ocrExtract(args) {
  const imagePath = String(args.imagePath || "");
  
  try {
    const Tesseract = require("tesseract.js");
    
    const { data: { text } } = await Tesseract.recognize(imagePath, "eng", {
      logger: () => {}, // Suppress logging
    });

    const cleanText = text.trim();
    
    if (!cleanText) {
      return {
        ok: true,
        text: "",
        artifact: {
          title: "OCR Result",
          kind: "markdown",
          content: "## No Text Found\n\nThe image doesn't appear to contain recognizable text.",
        },
      };
    }

    return {
      ok: true,
      text: cleanText,
      artifact: {
        title: "OCR Extracted Text",
        kind: "markdown",
        content: `## Extracted Text\n\n\`\`\`\n${cleanText}\n\`\`\`\n\n*Note: OCR accuracy varies. Please verify critical information.*`,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============== 1003 Checklist ==============

async function ensureChecklistSession() {
  try {
    await fs.access(checklistPath);
    const raw = await fs.readFile(checklistPath, "utf8");
    return JSON.parse(raw);
  } catch {
    const session = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      currentSection: "borrower_info",
      currentItem: 0,
      completed: {},
      values: {},
    };
    await fs.writeFile(checklistPath, JSON.stringify(session, null, 2));
    return session;
  }
}

async function saveChecklistSession(session) {
  await fs.writeFile(checklistPath, JSON.stringify(session, null, 2));
}

async function loadChecklist() {
  const checklistJsonPath = path.join(knowledgeDir, "1003-checklist.json");
  const raw = await fs.readFile(checklistJsonPath, "utf8");
  return JSON.parse(raw);
}

async function checklistStatus() {
  const session = await ensureChecklistSession();
  const checklist = await loadChecklist();
  
  let totalItems = 0;
  let completedItems = 0;
  const sectionStatus = [];

  for (const section of checklist.sections) {
    const sectionTotal = section.items.length;
    const sectionCompleted = section.items.filter((item) => session.completed[item.id]).length;
    totalItems += sectionTotal;
    completedItems += sectionCompleted;
    sectionStatus.push({
      name: section.name,
      completed: sectionCompleted,
      total: sectionTotal,
      percentage: Math.round((sectionCompleted / sectionTotal) * 100),
    });
  }

  const overallProgress = Math.round((completedItems / totalItems) * 100);

  const statusContent = sectionStatus.map((s) => 
    `- **${s.name}**: ${s.completed}/${s.total} (${s.percentage}%)`
  ).join("\n");

  return {
    ok: true,
    progress: overallProgress,
    sections: sectionStatus,
    artifact: {
      title: "1003 Application Progress",
      kind: "markdown",
      content: `## Loan Application Progress: ${overallProgress}%\n\n${statusContent}\n\n*Continue with checklist_next to proceed with the next item.*`,
    },
  };
}

async function checklistNext() {
  const session = await ensureChecklistSession();
  const checklist = await loadChecklist();
  
  // Find next incomplete item
  for (const section of checklist.sections) {
    for (const item of section.items) {
      if (!session.completed[item.id]) {
        const question = item.sensitive
          ? `**${item.label}** (${section.name})\n\n*Note: ${item.note || "Please provide this information directly."}*\n\nI'll need you to provide this - I won't assume or invent any values.`
          : `**${item.label}** (${section.name})\n\n${item.note ? `*Note: ${item.note}*` : ""}`;

        return {
          ok: true,
          currentItem: item,
          currentSection: section.name,
          artifact: {
            title: `1003: ${item.label}`,
            kind: "markdown",
            content: `## Next Item\n\n${question}\n\n---\n*Say the value, or "skip" to move on, or "status" to see progress.*`,
          },
        };
      }
    }
  }

  return {
    ok: true,
    complete: true,
    artifact: {
      title: "1003 Application Complete",
      kind: "markdown",
      content: "## Application Checklist Complete! 🎉\n\nAll sections have been reviewed. Use `checklist_status` to see a summary.",
    },
  };
}

async function checklistSetValue(args) {
  const session = await ensureChecklistSession();
  const itemId = String(args.itemId || "");
  const value = args.value;
  const skip = args.skip === true;

  if (skip) {
    session.completed[itemId] = true;
    session.values[itemId] = { skipped: true };
  } else {
    session.completed[itemId] = true;
    session.values[itemId] = { value, setAt: new Date().toISOString() };
  }

  await saveChecklistSession(session);

  return {
    ok: true,
    message: skip ? `Skipped ${itemId}` : `Saved ${itemId}`,
  };
}

async function checklistReset() {
  const session = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    currentSection: "borrower_info",
    currentItem: 0,
    completed: {},
    values: {},
  };
  await saveChecklistSession(session);
  
  return {
    ok: true,
    message: "Checklist reset. Starting fresh.",
    artifact: {
      title: "1003 Checklist Reset",
      kind: "markdown",
      content: "## Checklist Reset\n\nStarting a fresh loan application session. Use `checklist_next` to begin.",
    },
  };
}

// ============== Tool Specs ==============

const phase2ToolSpecs = [
  // Memory Tools
  {
    type: "function",
    name: "memory_save",
    description: "Save information to Luna's persistent memory for later recall.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The information to remember" },
        category: { type: "string", description: "Category (e.g., 'user_preference', 'project', 'contact')" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for searching" },
      },
      required: ["content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_search",
    description: "Search Luna's memory for previously saved information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        category: { type: "string", description: "Filter by category" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "memory_list",
    description: "List recent memories.",
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
    name: "memory_delete",
    description: "Delete a memory by ID. Requires confirmation.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["id", "confirmed"],
      additionalProperties: false,
    },
  },
  // Knowledge Base Tools
  {
    type: "function",
    name: "kb_search",
    description: "Search Luna's knowledge base for information on US lending, compliance, regulations, and borrower guidance. Use for questions about HMDA, CFPB, mortgages, 1003 forms, and lending industry topics.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "kb_topics",
    description: "List available knowledge base topics.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  // File Tools
  {
    type: "function",
    name: "file_parse",
    description: "Parse an uploaded file (CSV, XLSX, PDF, DOCX, TXT, images) and extract its content.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the uploaded file" },
        fileName: { type: "string", description: "Original filename" },
      },
      required: ["filePath"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ocr_extract",
    description: "Extract text from an image using OCR. Use for scanned documents, photos of forms, IDs, or paystubs.",
    parameters: {
      type: "object",
      properties: {
        imagePath: { type: "string", description: "Path to the image file" },
      },
      required: ["imagePath"],
      additionalProperties: false,
    },
  },
  // 1003 Checklist Tools
  {
    type: "function",
    name: "checklist_status",
    description: "Show the current status of the 1003 loan application checklist.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "checklist_next",
    description: "Get the next item in the 1003 loan application checklist.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "checklist_set_value",
    description: "Save a value for a checklist item or skip it.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The checklist item ID" },
        value: { type: "string", description: "The value to save" },
        skip: { type: "boolean", description: "Set true to skip this item" },
      },
      required: ["itemId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "checklist_reset",
    description: "Reset the 1003 checklist to start fresh.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

// ============== Handler ==============

async function handlePhase2Tool(name, args) {
  switch (name) {
    case "memory_save":
      return await memorySave(args);
    case "memory_search":
      return await memorySearch(args);
    case "memory_list":
      return await memoryList(args);
    case "memory_delete":
      return await memoryDelete(args);
    case "kb_search":
      return await kbSearch(args);
    case "kb_topics":
      return await kbTopics();
    case "file_parse":
      return await parseUploadedFile(args);
    case "ocr_extract":
      return await ocrExtract(args);
    case "checklist_status":
      return await checklistStatus();
    case "checklist_next":
      return await checklistNext();
    case "checklist_set_value":
      return await checklistSetValue(args);
    case "checklist_reset":
      return await checklistReset();
    default:
      return null;
  }
}

module.exports = {
  phase2ToolSpecs,
  handlePhase2Tool,
};
