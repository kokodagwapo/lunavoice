#!/usr/bin/env node
/**
 * Fix Electron.app menu bar name on macOS during development.
 * 
 * The node_modules/electron/dist/Electron.app Info.plist has CFBundleName="Electron"
 * which overrides app.setName() for the macOS menu bar. This script patches it
 * to show "SmartStart" instead.
 * 
 * Run automatically via postinstall or manually: node scripts/fix-electron-name.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const APP_NAME = "SmartStart";

// Possible paths to Electron.app Info.plist
const PLIST_PATHS = [
  path.join(__dirname, "..", "node_modules", "electron", "dist", "Electron.app", "Contents", "Info.plist"),
  path.join(__dirname, "..", "node_modules", "electron", "dist", "Electron.app", "Contents", "Resources", "en.lproj", "InfoPlist.strings"),
];

function patchPlist(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, "utf8");
    let modified = false;

    // Replace CFBundleName
    if (content.includes("<key>CFBundleName</key>")) {
      content = content.replace(
        /(<key>CFBundleName<\/key>\s*<string>)[^<]*(<\/string>)/g,
        `$1${APP_NAME}$2`
      );
      modified = true;
    }

    // Replace CFBundleDisplayName
    if (content.includes("<key>CFBundleDisplayName</key>")) {
      content = content.replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/g,
        `$1${APP_NAME}$2`
      );
      modified = true;
    }

    // For InfoPlist.strings format (key = value)
    if (content.includes("CFBundleName")) {
      content = content.replace(
        /CFBundleName\s*=\s*"[^"]*"/g,
        `CFBundleName = "${APP_NAME}"`
      );
      modified = true;
    }
    if (content.includes("CFBundleDisplayName")) {
      content = content.replace(
        /CFBundleDisplayName\s*=\s*"[^"]*"/g,
        `CFBundleDisplayName = "${APP_NAME}"`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✓ Patched ${path.basename(filePath)} → "${APP_NAME}"`);
      return true;
    }
  } catch (error) {
    console.warn(`⚠ Could not patch ${filePath}:`, error.message);
  }
  return false;
}

function main() {
  // Only run on macOS
  if (process.platform !== "darwin") {
    console.log("⏭ Skipping Electron name fix (not macOS)");
    return;
  }

  console.log(`🔧 Fixing Electron.app menu bar name to "${APP_NAME}"...`);

  let patched = false;
  for (const plistPath of PLIST_PATHS) {
    if (patchPlist(plistPath)) {
      patched = true;
    }
  }

  if (patched) {
    console.log("✅ Electron menu bar name fixed for development");
  } else {
    console.log("ℹ No Electron.app plist found (may not be installed yet)");
  }
}

main();
