import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

let port;
let server;
let browser;

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
    // Start local static HTTP server with dynamic port allocation
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

    browser = await chromium.launch({ headless: true });
});

after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
});

describe("PrimalJS End-to-End (E2E) Browser Suite", () => {
    it("loads required first example (examples/hello) in real browser with zero build step", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });
        const title = await page.title();
        assert.equal(title, "PrimalJS — Required First Example");
        const btn = page.locator(".btn");
        assert.equal((await btn.textContent()).trim(), "Count: 0");
        await btn.click();
        assert.equal((await btn.textContent()).trim(), "Count: 1");
        await context.close();
    });

    it("runs reactive todo app (examples/todo) with state updates & list items", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/todo/index.html`, { waitUntil: "domcontentloaded" });
        const initialCount = await page.locator(".todo-item").count();
        await page.type(".input-text", "Write E2E Browser Test");
        await page.click("button[type='submit']");
        assert.equal(await page.locator(".todo-item").count(), initialCount + 1);
        await context.close();
    });

    it("runs declarative conditional app (examples/conditional) testing <If>, <ElseIf>, <Else>", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/conditional/index.html`, { waitUntil: "domcontentloaded" });
        const loadingText = (await page.locator(".loading-msg").textContent()).trim();
        assert.ok(loadingText.includes("Loading data from server"));
        await page.click(".btn-ready");
        const readyHeader = (await page.locator(".dashboard-header").textContent()).trim();
        assert.ok(readyHeader.includes("Dashboard Ready"));
        await context.close();
    });

    it("runs declarative switch app (examples/switch) testing <Switch>, <Case>, <Default>", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/switch/index.html`, { waitUntil: "domcontentloaded" });
        const switchLoading = (await page.locator(".loading-text").textContent()).trim();
        assert.ok(switchLoading.includes("Loading data"));
        await page.click(".btn-complete");
        const switchComplete = (await page.locator(".complete-header").textContent()).trim();
        assert.ok(switchComplete.includes("Task Complete"));
        await context.close();
    });

    it("runs declarative loop app (examples/for) testing <For>, <Continue>, <Break>, <Else>", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/for/index.html`, { waitUntil: "domcontentloaded" });
        assert.equal(await page.locator(".user-card").count(), 2);
        await page.click(".btn-toggle-stop");
        assert.equal(await page.locator(".user-card").count(), 3);
        await page.click(".btn-add");
        assert.equal(await page.locator(".user-card").count(), 4);
        await context.close();
    });

    it("runs declarative try/catch app (examples/try_catch) testing <Try>, <Catch>", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/try_catch/index.html`, { waitUntil: "domcontentloaded" });
        const statusMsg = (await page.locator(".status-msg").textContent()).trim();
        assert.ok(statusMsg.includes("Dashboard is working smoothly"));
        await page.click(".btn-cause-error");
        const errText = (await page.locator(".err-text").textContent()).trim();
        assert.ok(errText.includes("Dashboard rendering failed"));
        await context.close();
    });

    it("runs declarative async/await app (examples/async_await) awaiting promises & pending/catch states", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/async_await/index.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".status-box p");
        assert.ok((await page.locator(".status-box p").first().textContent()).length > 0);
        await context.close();
    });

    it("runs expressive delay & wait app (examples/delay_wait) testing <Delay>, <Wait>, <Briefly>, <Failed>", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/delay_wait/index.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".user-info");
        const userInfo = (await page.locator(".user-info").textContent()).trim();
        assert.ok(userInfo.includes("User #1 (Lemuel)"));
        await context.close();
    });

    it("runs dynamic render app (examples/render) testing <Mount> component switching", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/render/index.html`, { waitUntil: "domcontentloaded" });
        const profileHeader = (await page.locator(".profile-view h3").textContent()).trim();
        assert.equal(profileHeader, "Profile Component");
        await context.close();
    });
});
