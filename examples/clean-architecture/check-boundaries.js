import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const allowed = {
    domain: ["domain"],
    application: ["application", "domain"],
    infrastructure: ["infrastructure", "application", "domain"],
    ui: ["ui", "application", "domain", "framework"]
};
const violations = [];
for (const [layer, dependencies] of Object.entries(allowed)) {
    for (const entry of await readdir(path.join(root, layer))) {
        if (!entry.endsWith(".js")) continue;
        const file = path.join(root, layer, entry);
        const source = await readFile(file, "utf8");
        // This example uses only static imports with literal specifiers.
        for (const match of source.matchAll(/^import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/gm)) {
            const specifier = match[1];
            const resolved = path.resolve(path.dirname(file), specifier);
            const relative = path.relative(root, resolved);
            const target = specifier.startsWith(".") && !relative.startsWith("..")
                ? relative.split(path.sep)[0]
                : specifier === "@lemadane/primaljs" || resolved === path.resolve(root, "../../src/index.js")
                    ? "framework" : "external";
            if (!dependencies.includes(target)) {
                violations.push(`${layer}/${entry} cannot import ${specifier}`);
            }
        }
    }
}
if (violations.length) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
} else {
    console.log("Example dependency boundaries passed.");
}
