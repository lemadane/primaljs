/**
 * Standalone Zero-Dependency ES Module Bundler & Minifier Script for PrimalJS
 * Bundles framework core files into:
 * 1. dist/primal.standalone.js (unminified, human-readable ES module)
 * 2. dist/primal.min.js & primal.min.js (minified ES module with JSDoc comments preserved)
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
    "load.js",
    "app.js",
    "activate.js",
    "registry.js",
    "router.js",
    "html.js",
    "guard.js",
    "place.js",
    "within-view.js",
    "animate.js",
    "keep.js",
    "on-idle.js",
    "focus.js",
    "on-key.js",
    "scroll-lock.js",
    "on-outside-click.js",
    "async.js",
    "index.js"
];

let bundledCode = `/**\n * PrimalJS Standalone Browser ES Module (Zero-Build Bundle)\n * Credits\n * Creator and designer: Lemuel Adane\n * Development assistance: Codex\n * Testing and quality assurance assistance: ChatGPT\n */\n\n`;

for (const modFile of modules) {
    const filePath = path.join(srcDir, modFile);
    if (!fs.existsSync(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");

    // Remove internal ES module import statements
    content = content.replace(/^import\s+[\s\S]*?from\s+["']\..*?["'];?\s*$/gm, "");

    if (modFile === "index.js") {
        // Strip relative 'from "./..."' clauses so re-exports reference top-level concatenated declarations
        content = content.replace(/\s+from\s+["']\..*?["']/g, "");
    } else {
        // Remove internal export keywords (handling async functions, functions, classes, vars)
        content = content.replace(/^export\s+(async\s+)?(class|function|const|let|var)\s+/gm, "$1$2 ");
        content = content.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, "");
    }

    bundledCode += `// --- Module: ${modFile} ---\n` + content.trim() + "\n\n";
}

const outputPath = path.join(distDir, "primal.standalone.js");
fs.writeFileSync(outputPath, bundledCode, "utf8");
console.log(`[PrimalJS Build]: Created standalone zero-build bundle at ${outputPath}`);

/**
 * Custom zero-dependency JS minifier preserving JSDoc comments & regex literals
 *
 * @param {string} code
 * @returns {string}
 */
function minifyJS(code) {
    let result = '';
    let i = 0;
    const len = code.length;

    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let isEscaped = false;

    function isWordChar(ch) {
        return /[a-zA-Z0-9_$]/.test(ch);
    }

    function getLastToken(str) {
        const trimmed = str.trimEnd();
        if (!trimmed) return '';
        const match = trimmed.match(/([a-zA-Z0-9_$]+|[^\s\w])$/);
        return match ? match[1] : '';
    }

    const regexStartTokens = new Set([
        '(', '=', ':', ',', '?', '!', '&', '|', '+', '-', '*', '/', '<', '>', ';', '{', '}', '[', '~', '^', '%',
        'return', 'case', 'typeof', 'instanceof', 'yield', 'await', 'delete', 'void', 'throw', 'new', 'do', 'else'
    ]);

    while (i < len) {
        const char = code[i];
        const nextChar = code[i + 1];

        // Handle string literals '...' or "..."
        if (!inTemplate && (char === "'" || char === '"')) {
            if (!inString) {
                inString = true;
                stringChar = char;
                result += char;
                i++;
                continue;
            } else if (char === stringChar && !isEscaped) {
                inString = false;
                result += char;
                i++;
                continue;
            }
        }

        if (inString) {
            result += char;
            if (char === '\\' && !isEscaped) {
                isEscaped = true;
            } else {
                isEscaped = false;
            }
            i++;
            continue;
        }

        // Handle template literals `...`
        if (char === '`' && !isEscaped) {
            inTemplate = !inTemplate;
            result += char;
            i++;
            continue;
        }

        if (inTemplate) {
            result += char;
            if (char === '\\' && !isEscaped) {
                isEscaped = true;
            } else {
                isEscaped = false;
            }
            i++;
            continue;
        }

        // Check for RegExp literal start vs Division vs Comment
        if (char === '/') {
            const lastToken = getLastToken(result);
            const isRegexpStart = regexStartTokens.has(lastToken);

            if (isRegexpStart && nextChar !== '/' && nextChar !== '*') {
                // Parse RegExp literal
                result += char;
                i++;
                let inCharClass = false;
                let regEscaped = false;
                while (i < len) {
                    const rChar = code[i];
                    result += rChar;
                    if (regEscaped) {
                        regEscaped = false;
                    } else if (rChar === '\\') {
                        regEscaped = true;
                    } else if (rChar === '[') {
                        inCharClass = true;
                    } else if (rChar === ']' && inCharClass) {
                        inCharClass = false;
                    } else if (rChar === '/' && !inCharClass) {
                        i++;
                        // Read flags
                        while (i < len && /[a-z]/i.test(code[i])) {
                            result += code[i];
                            i++;
                        }
                        break;
                    }
                    i++;
                }
                continue;
            }

            // Multi-line comment
            if (nextChar === '*') {
                const commentEnd = code.indexOf('*/', i + 2);
                if (commentEnd === -1) break;
                const commentText = code.slice(i, commentEnd + 2);

                if (commentText.startsWith('/**') || commentText.startsWith('/*!')) {
                    const cleanComment = commentText
                        .split('\n')
                        .map(l => l.trim())
                        .filter(Boolean)
                        .join('\n');
                    result += (result && !result.endsWith('\n') ? '\n' : '') + cleanComment + '\n';
                }
                i = commentEnd + 2;
                continue;
            }

            // Single line comment
            if (nextChar === '/') {
                const lineEnd = code.indexOf('\n', i + 2);
                if (lineEnd === -1) break;
                i = lineEnd + 1;
                continue;
            }
        }

        // Whitespace handling
        if (/\s/.test(char)) {
            while (i < len && /\s/.test(code[i])) {
                i++;
            }
            const prevChar = result[result.length - 1] || '';
            const nextValidChar = code[i] || '';
            if (isWordChar(prevChar) && isWordChar(nextValidChar)) {
                result += ' ';
            }
            continue;
        }

        result += char;
        i++;
    }

    return result.trim();
}

const minifiedCode = minifyJS(bundledCode);
const minifiedDistPath = path.join(distDir, "primal.min.js");
const minifiedRootPath = path.join(rootDir, "primal.min.js");

fs.writeFileSync(minifiedDistPath, minifiedCode, "utf8");
fs.writeFileSync(minifiedRootPath, minifiedCode, "utf8");

const rawSizeKb = (Buffer.byteLength(bundledCode, "utf8") / 1024).toFixed(2);
const minSizeKb = (Buffer.byteLength(minifiedCode, "utf8") / 1024).toFixed(2);

console.log(`[PrimalJS Build]: Created minified ES module bundle (JSDoc preserved) at ${minifiedDistPath}`);
console.log(`[PrimalJS Build]: Updated root minified ES module at ${minifiedRootPath}`);
console.log(`[PrimalJS Build]: Size reduced from ${rawSizeKb} KB to ${minSizeKb} KB`);
