import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

let playwright;
try {
    playwright = await import("playwright");
} catch (_) {}

let port;
let server;

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".html": return "text/html";
        case ".js": return "text/javascript";
        case ".css": return "text/css";
        case ".json": return "application/json";
        default: return "application/octet-stream";
    }
}

before(async () => {
    server = http.createServer((req, res) => {
        const rootDir = path.resolve(".");
        const safePath = path.normalize(req.url.split("?")[0]).replace(/^(\.\.[\/\\])+/, "");
        let filePath = path.join(rootDir, safePath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, "index.html");
        }

        if (!fs.existsSync(filePath)) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
            return;
        }

        const mime = getMimeType(filePath);
        res.writeHead(200, { "Content-Type": mime });
        fs.createReadStream(filePath).pipe(res);
    });

    await new Promise((resolve) => {
        server.listen(0, () => {
            port = server.address().port;
            resolve();
        });
    });
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
});

describe("PrimalJS Cross-Browser E2E Engine Suite (Chromium, Firefox, Safari/WebKit, Microsoft Edge, Android Internet)", () => {
    const browserTargets = [
        { name: "Chromium", engine: "chromium" },
        { name: "Firefox", engine: "firefox" },
        { name: "Safari (WebKit)", engine: "webkit" },
        { name: "Microsoft Edge", engine: "chromium", channel: "msedge" },
        {
            name: "Android Internet Browser",
            engine: "chromium",
            device: {
                userAgent: "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36",
                viewport: { width: 360, height: 740 },
                deviceScaleFactor: 3,
                isMobile: true,
                hasTouch: true
            }
        }
    ];

    for (const target of browserTargets) {
        it(`runs full PrimalJS E2E app suite in ${target.name}`, async (t) => {
            if (!playwright || !playwright[target.engine]) {
                t.skip(`Playwright ${target.engine} engine not available.`);
                return;
            }

            let browser;
            try {
                const launchOptions = { headless: true };
                if (target.channel) launchOptions.channel = target.channel;
                browser = await playwright[target.engine].launch(launchOptions);
            } catch (err) {
                t.skip(`Skipping ${target.name} (Host missing browser binary or system dependencies: ${err.message.split("\n")[0]})`);
                return;
            }

            try {
                const contextOptions = target.device ? { ...target.device } : {};
                const context = await browser.newContext(contextOptions);
                const page = await context.newPage();

                // 1. Hello World Example (examples/hello)
                await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });
                const title = await page.title();
                assert.equal(title, "PrimalJS — Required First Example");
                const btn = page.locator(".btn");
                assert.equal((await btn.textContent()).trim(), "Count: 0");
                await btn.click();
                assert.equal((await btn.textContent()).trim(), "Count: 1");

                // 2. Reactive Todo App Example (examples/todo)
                await page.goto(`http://localhost:${port}/examples/todo/index.html`, { waitUntil: "domcontentloaded" });
                const initialTodoCount = await page.locator(".todo-item").count();
                await page.type(".input-text", `Cross-Browser ${target.name} Item`);
                await page.click("button[type='submit']");
                assert.equal(await page.locator(".todo-item").count(), initialTodoCount + 1);



                // 8. Dynamic Component Switcher Example (<Load>) (examples/render)
                await page.goto(`http://localhost:${port}/examples/render/index.html`, { waitUntil: "domcontentloaded" });
                const profileHeader = (await page.locator(".profile-view h3").textContent()).trim();
                assert.equal(profileHeader, "Profile Component");

                await context.close();
            } finally {
                await browser.close();
            }
        });
    }
});
