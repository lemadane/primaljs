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

    it("runs reactive todo app (examples/todo) with keyed reconciliation, event handling & item removal", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/todo/index.html`, { waitUntil: "domcontentloaded" });

        const initialCount = await page.locator("li.todo-item").count();
        assert.equal(initialCount, 3);

        // Add a new todo item
        await page.fill(".input-text", "Write E2E Browser Test");
        await page.click("button[type='submit']");

        // Verify count updated
        assert.equal(await page.locator("li.todo-item").count(), 4);

        // Toggle checkbox on the 4th item
        const lastItemCheckbox = page.locator("li.todo-item").nth(3).locator("input[type='checkbox']");
        await lastItemCheckbox.click();
        await page.waitForTimeout(100);

        // Verify completion styling applied
        const lastItemClass = await page.locator("li.todo-item").nth(3).getAttribute("class");
        assert.ok(lastItemClass.includes("completed"));

        // Delete the 4th item
        await page.click("li.todo-item:last-child .del-btn");
        assert.equal(await page.locator("li.todo-item").count(), 3);

        await context.close();
    });

    it("runs dynamic render app (examples/render) testing <Load> component switching", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/examples/render/index.html`, { waitUntil: "domcontentloaded" });
        const profileHeader = (await page.locator(".profile-view h3").textContent()).trim();
        assert.equal(profileHeader, "Profile Component");
        await context.close();
    });

    it("runs full SPA showcase app (examples/showcase) testing router navigation, signals, SEO head & <Wait> async resources", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/showcase/index.html`, { waitUntil: "domcontentloaded" });

        // 1. Dashboard Page Verification
        await page.waitForSelector(".counter-val");
        assert.equal(await page.title(), "Dashboard | PrimalJS Showcase");
        assert.equal((await page.locator(".counter-val").textContent()).trim(), "0");

        await page.click(".btn-inc");
        assert.equal((await page.locator(".counter-val").textContent()).trim(), "1");

        await page.fill(".input-field", "PrimalJS E2E Test");
        assert.equal((await page.locator(".bound-text").textContent()).trim(), "PrimalJS E2E Test");

        // 2. SPA Navigation to /users
        await page.click("a[href='/users']");
        await page.waitForSelector(".search-input");
        assert.equal(await page.title(), "Users | PrimalJS Showcase");

        await page.fill(".search-input", "Lemuel");
        const userRows = await page.locator(".user-row").count();
        assert.equal(userRows, 1);

        // 3. SPA Navigation to /async testing <Wait> and <Briefly>
        await page.click("a[href='/async']");
        await page.waitForTimeout(20);
        assert.equal(await page.title(), "Async Loader | PrimalJS Showcase");

        // Verify <Wait> resolved state
        await page.waitForSelector(".async-result", { timeout: 2000 });
        const asyncText = await page.locator(".async-result h3").textContent();
        assert.ok(asyncText.includes("Data Resolved Successfully"));

        await context.close();
    });
});
