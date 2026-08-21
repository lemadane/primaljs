/**
 * Standalone Zero-Dependency ES Module Bundler Script for PrimalJS
 * Bundles framework core files into a single zero-dependency standalone ES module (dist/primal.standalone.js)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Ordered module sequence for concatenation without external import statements
const modules = [
    "owner.js",
    "diagnostics.js",
    "signal.js",
    "ref.js",
    "seo.js",
    "lifecycle.js",
    "pwa.js",
    "mount.js",
    "app.js",
    "activate.js",
    "registry.js",
    "router.js",
    "html.js",
    "boundary.js",
    "index.js"
];

let bundledCode = `/**\n * PrimalJS Standalone Browser ES Module (Zero-Build Bundle)\n * Author: Lemuel Adane | Code: Google Antigravity | QA: ChatGPT\n */\n\n`;

for (const modFile of modules) {
    const filePath = path.join(srcDir, modFile);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");

    // Remove internal ES module import statements
    content = content.replace(/^import\s+[\s\S]*?from\s+["']\..*?["'];?\s*$/gm, "");

    // Remove internal export keywords inside bundled code except for final index.js exports
    if (modFile !== "index.js") {
        content = content.replace(/^export\s+(class|function|const|let|var)\s+/gm, "$1 ");
        content = content.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, "");
    }

    bundledCode += `// --- Module: ${modFile} ---\n` + content.trim() + "\n\n";
}

const outputPath = path.join(distDir, "primal.standalone.js");
fs.writeFileSync(outputPath, bundledCode, "utf8");
console.log(`[PrimalJS Build]: Created standalone zero-build bundle at ${outputPath}`);
