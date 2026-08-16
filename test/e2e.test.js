import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const PORT = 8085;
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
    // Start local static HTTP server
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

    await new Promise((resolve) => server.listen(PORT, resolve));

    // Launch Headless Chrome
    browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
});

after(async () => {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
});

describe("PrimalJS End-to-End (E2E) Browser Suite", () => {
    it("loads required first example (examples/hello) in real browser with zero build step", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/hello/index.html`, {
            waitUntil: "networkidle0"
        });

        const title = await page.title();
        assert.equal(title, "PrimalJS — Required First Example");

        const greetingText = await page.$eval("h2", el => el.textContent.trim());
        assert.equal(greetingText, "Hello Lemuel");

        const button = await page.$(".btn");
        const initialText = await page.evaluate(el => el.textContent.trim(), button);
        assert.equal(initialText, "Count: 0");

        await button.click();
        const updatedText = await page.evaluate(el => el.textContent.trim(), button);
        assert.equal(updatedText, "Count: 1");

        await page.close();
    });

    it("runs reactive todo app (examples/todo) with state updates & list items", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/todo/index.html`, {
            waitUntil: "networkidle0"
        });

        const itemsCount = await page.$$eval(".todo-item", items => items.length);
        assert.equal(itemsCount, 3);

        await page.type(".input-text", "Write Playwright/Puppeteer E2E Tests");
        await page.click("button[type='submit']");

        const newCount = await page.$$eval(".todo-item", items => items.length);
        assert.equal(newCount, 4);

        await page.close();
    });

    it("runs declarative conditional app (examples/conditional) toggling <If>, <ElseIf>, <Else> DOM ranges in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/conditional/index.html`, {
            waitUntil: "networkidle0"
        });

        const loadingText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(loadingText.includes("Loading data from server"));

        const buttons = await page.$$(".btn-secondary");
        await buttons[1].click(); // Error button

        const errorText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(errorText.includes("Something went wrong"));

        await buttons[2].click(); // Ready button

        const readyHeader = await page.$eval(".status-box h3", el => el.textContent.trim());
        assert.ok(readyHeader.includes("Dashboard Ready"));

        await page.close();
    });

    it("runs declarative switch app (examples/switch) toggling <Switch>, <Case>, <Default> DOM ranges in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/switch/index.html`, {
            waitUntil: "networkidle0"
        });

        const loadingText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(loadingText.includes("Loading data"));

        const buttons = await page.$$(".btn-secondary");
        await buttons[1].click();

        const processingText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(processingText.includes("Processing tasks"));

        await buttons[2].click();

        const completeHeader = await page.$eval(".status-box h3", el => el.textContent.trim());
        assert.ok(completeHeader.includes("Task Complete"));

        await buttons[3].click();

        const unknownText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(unknownText.includes("Unknown status state"));

        await page.close();
    });

    it("runs declarative loop app (examples/for) with <For>, <Continue>, <Break>, <Else> in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/for/index.html`, {
            waitUntil: "networkidle0"
        });

        const initialCards = await page.$$eval(".user-card", cards => cards.map(c => c.textContent.trim()));
        assert.equal(initialCards.length, 2);
        assert.ok(initialCards[0].includes("John"));
        assert.ok(initialCards[1].includes("Anna"));

        const buttons = await page.$$(".btn-secondary");
        await buttons[0].click(); // Clear List

        const emptyText = await page.$eval(".empty-card p", el => el.textContent.trim());
        assert.equal(emptyText, "No users found in collection.");

        await buttons[1].click(); // Restore List
        const restoredCount = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(restoredCount, 2);

        await buttons[2].click(); // Toggle Break
        const countAfterToggle = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(countAfterToggle, 3); // John, Anna, David

        await page.close();
    });

    it("runs declarative try/catch app (examples/try_catch) catching errors & performing reset recovery in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/try_catch/index.html`, {
            waitUntil: "networkidle0"
        });

        const initialText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(initialText.includes("Dashboard is working smoothly"));

        const causeBtn = await page.$(".btn-danger");
        await causeBtn.click();

        const errHeader = await page.$eval(".error-box h3", el => el.textContent.trim());
        assert.equal(errHeader, "Caught UI Error");
        const errDetail = await page.$eval(".error-box p", el => el.textContent.trim());
        assert.ok(errDetail.includes("Dashboard rendering failed"));

        const fixBtn = await page.$(".btn-success");
        await fixBtn.click();

        const resetBtn = await page.$(".error-box button");
        await resetBtn.click();

        const recoveredText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(recoveredText.includes("Dashboard is working smoothly"));

        await page.close();
    });

    it("runs declarative async/await app (examples/async_await) awaiting promises & pending/catch states in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/async_await/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Pending state displayed initially
        const pendingText = await page.$eval(".pending-box p", el => el.textContent.trim());
        assert.ok(pendingText.includes("Fetching notifications for User #1"));

        // 2. Wait for resolution
        await page.waitForSelector(".status-box h3");
        const loadedText = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(loadedText.includes("User #1 (Lemuel)"));

        // 3. Click Trigger Network Error
        const buttons = await page.$$(".btn-secondary");
        await buttons[2].click(); // Trigger error button

        await page.waitForSelector(".error-box h3");
        const errHeader = await page.$eval(".error-box h3", el => el.textContent.trim());
        assert.equal(errHeader, "Network Rejection Caught");

        // 4. Click Load User #2
        await buttons[1].click(); // Load User #2
        await page.waitForSelector(".status-box h3");
        const user2Text = await page.$eval(".status-box p", el => el.textContent.trim());
        assert.ok(user2Text.includes("User #2 (Lemuel)"));

        await page.close();
    });
});
