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
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote",
            "--single-process"
        ]
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

        const greetingText = await page.$eval("h2", el => el.textContent.replace(/\s+/g, " ").trim());
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

    it("runs declarative conditional app (examples/conditional) testing <If>, <ElseIf>, <Else>, computed conditions, nested <If>, and empty region in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/conditional/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Initial <If> branch (loading)
        const loadingText = await page.$eval(".loading-msg", el => el.textContent.trim());
        assert.ok(loadingText.includes("Loading data from server"));

        // 2. Click Error -> <ElseIf> branch
        await page.click(".btn-error");
        const errorText = await page.$eval(".error-msg", el => el.textContent.trim());
        assert.ok(errorText.includes("Something went wrong"));

        // 3. Click Ready -> <ElseIf> branch with nested <If> admin panel
        await page.click(".btn-ready");
        const readyHeader = await page.$eval(".dashboard-header", el => el.textContent.trim());
        assert.ok(readyHeader.includes("Dashboard Ready"));

        // Check nested <If> computed condition (admin panel active)
        const adminBadge = await page.$eval(".admin-badge", el => el.textContent.trim());
        assert.ok(adminBadge.includes("Admin Control Panel Active"));

        // 4. Toggle Details -> Nested <If> boolean condition
        await page.click(".btn-toggle-details");
        const detailsText = await page.$eval(".details-text", el => el.textContent.trim());
        assert.ok(detailsText.includes("Sensitive system metrics"));

        // 5. Toggle Role -> Nested <If> computed condition turns false
        await page.click(".btn-toggle-role");
        const adminPanel = await page.$(".admin-panel");
        assert.equal(adminPanel, null);

        // 6. Click None -> No branch matches and no Else -> Empty DOM range
        await page.click(".btn-none");
        const statusBox = await page.$(".status-box");
        assert.equal(statusBox, null);

        await page.close();
    });

    it("runs declarative switch app (examples/switch) testing <Switch>, <Case>, <Default>, multiple values array, predicate matching, and nested <Switch> in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/switch/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Initial single value match (<Case value="loading">)
        const loadingText = await page.$eval(".loading-text", el => el.textContent.trim());
        assert.ok(loadingText.includes("Loading data"));

        // 2. Multiple values array match (<Case value=${["pending", "processing"]}>)
        await page.click(".btn-processing");
        const processingText = await page.$eval(".processing-text", el => el.textContent.trim());
        assert.ok(processingText.includes("Processing tasks"));

        // 3. Single value match (<Case value="complete">) with nested <Switch>
        await page.click(".btn-complete");
        const completeHeader = await page.$eval(".complete-header", el => el.textContent.trim());
        assert.ok(completeHeader.includes("Task Complete"));

        // Check nested <Switch> summary view
        const nestedSummary = await page.$eval(".nested-summary", el => el.textContent.trim());
        assert.ok(nestedSummary.includes("Nested Switch: Summary View Active"));

        // Toggle nested <Switch> view mode -> detail
        await page.click(".btn-toggle-nested");
        const nestedDetail = await page.$eval(".nested-detail", el => el.textContent.trim());
        assert.ok(nestedDetail.includes("Nested Switch: Extended Technical Metrics View"));

        // 4. Predicate function match (<Case value=${val => val > 100}>)
        await page.click(".btn-score");
        const scoreHeader = await page.$eval(".score-header", el => el.textContent.trim());
        assert.ok(scoreHeader.includes("Predicate Case Matched: High Score (150)"));

        // 5. Default fallback (<Default>)
        await page.click(".btn-unknown");
        const unknownText = await page.$eval(".unknown-text", el => el.textContent.trim());
        assert.ok(unknownText.includes("Unknown status state"));

        // 6. Empty region (no match & no default)
        await page.click(".btn-none");
        const statusBox = await page.$(".status-box");
        assert.equal(statusBox, null);

        await page.close();
    });

    it("runs declarative loop app (examples/for) testing <For>, <Continue>, <Break>, <Else>, item addition/removal, and nested <For> in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/for/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Initial keyed iteration (<Continue> skips inactive Mike, <Break> stops at StopHere)
        const initialCards = await page.$$eval(".user-card", cards => cards.map(c => c.textContent.trim()));
        assert.equal(initialCards.length, 2);
        assert.ok(initialCards[0].includes("John"));
        assert.ok(initialCards[1].includes("Anna"));

        // Check nested <For> tags rendering
        const johnTags = await page.$$eval(".user-card:first-child .tag-badge", tags => tags.map(t => t.textContent.trim()));
        assert.deepEqual(johnTags, ["admin", "lead"]);

        // 2. Add Item -> Dynamic item append
        await page.click(".btn-add");
        const countAfterAdd = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(countAfterAdd, 3); // John, Anna, User_xxxx

        // 3. Remove Item -> Dynamic item removal
        await page.click(".btn-remove");
        const countAfterRemove = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(countAfterRemove, 2); // Anna, User_xxxx

        // 4. Clear List -> Empty collection fallback <Else>
        await page.click(".btn-clear");
        const emptyText = await page.$eval(".empty-text", el => el.textContent.trim());
        assert.equal(emptyText, "No users found in collection.");

        // 5. Restore List
        await page.click(".btn-restore");
        const restoredCount = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(restoredCount, 2); // John, Anna

        // 6. Toggle Break -> Loop includes David after StopHere
        await page.click(".btn-toggle-stop");
        const countAfterToggle = await page.$$eval(".user-card", cards => cards.length);
        assert.equal(countAfterToggle, 3); // John, Anna, David

        await page.close();
    });

    it("runs declarative try/catch app (examples/try_catch) testing <Try>, <Catch>, non-Error thrown values, nested boundaries, rethrowing, static catch, and reset recovery in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/try_catch/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Single Boundary Error Capture
        const initialText = await page.$eval(".status-msg", el => el.textContent.trim());
        assert.ok(initialText.includes("Dashboard is working smoothly"));

        // Cause Error
        await page.click(".btn-cause-error");
        const errDetail = await page.$eval(".err-text", el => el.textContent.trim());
        assert.ok(errDetail.includes("Dashboard rendering failed"));

        // Fix condition and reset boundary
        await page.click(".btn-fix");
        await page.click(".btn-reset");
        const recoveredText = await page.$eval(".status-msg", el => el.textContent.trim());
        assert.ok(recoveredText.includes("Dashboard is working smoothly"));

        // 2. Non-Error thrown string capture
        await page.click(".btn-cause-string");
        const stringErrText = await page.$eval(".err-text", el => el.textContent.trim());
        assert.ok(stringErrText.includes("Raw String Error Thrown"));

        await page.click(".btn-fix");
        await page.click(".btn-reset");

        // 3. Nested Boundaries & Rethrowing
        await page.click(".btn-mode-nested");
        const innerText = await page.$eval(".inner-msg", el => el.textContent.trim());
        assert.ok(innerText.includes("Inner Subtree Data Loaded"));

        // Inner error caught by inner boundary
        await page.click(".btn-cause-error");
        const innerErrText = await page.$eval(".inner-err-text", el => el.textContent.trim());
        assert.ok(innerErrText.includes("Inner Component Local Error"));

        await page.click(".btn-fix");
        await page.click(".btn-reset-inner");

        // Rethrow inside inner catch propagates to outer boundary
        await page.click(".btn-cause-rethrow");
        const outerErrText = await page.$eval(".outer-err-text", el => el.textContent.trim());
        assert.ok(outerErrText.includes("Inner Boundary Error -> Rethrown to Outer"));

        await page.click(".btn-fix");
        await page.click(".btn-reset-outer");

        // 4. Static Catch Mode
        await page.click(".btn-mode-static");
        await page.click(".btn-cause-error");
        const staticErrBox = await page.$eval(".static-err-box h3", el => el.textContent.trim());
        assert.equal(staticErrBox, "Static Fallback View");

        await page.close();
    });

    it("runs declarative async/await app (examples/async_await) awaiting promises & pending/catch states in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/async_await/index.html`, {
            waitUntil: "domcontentloaded"
        });

        // 1. Check pending state or resolution
        await page.waitForSelector(".pending-box p, .status-box h3");
        const initialElement = await page.$(".pending-box p, .status-box h3");
        assert.ok(initialElement, "Either pending or loaded state rendered successfully");

        // 2. Wait for resolution
        await page.waitForSelector(".status-box h3");
        const loadedText = await page.$eval(".status-box p:nth-of-type(2)", el => el.textContent.trim());
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
        const user2Text = await page.$eval(".status-box p:nth-of-type(2)", el => el.textContent.trim());
        assert.ok(user2Text.includes("User #2 (Lemuel)"));

        await page.close();
    });

    it("runs expressive delay & wait app (examples/delay_wait) testing all 3 modes (<Delay task>, <Wait for>, <Delay component>) with <Briefly> and <Failed> in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/delay_wait/index.html`, {
            waitUntil: "domcontentloaded"
        });

        // --- Mode 1: <Delay task> Mode ---
        await page.waitForSelector(".briefly-text, .status-box h3");
        await page.waitForSelector(".user-info");
        const userInfo = await page.$eval(".user-info", el => el.textContent.trim());
        assert.ok(userInfo.includes("User #1 (Lemuel)"));

        // Trigger Fail State
        await page.click(".btn-fail");
        await page.waitForSelector(".failed-box h3");
        const errHeader = await page.$eval(".failed-box h3", el => el.textContent.trim());
        assert.equal(errHeader, "Operation Failed");

        // Load Profile #2
        await page.click(".btn-user-2");
        await page.waitForSelector(".user-info");
        const user2Info = await page.$eval(".user-info", el => el.textContent.trim());
        assert.ok(user2Info.includes("User #2 (Lemuel)"));

        // --- Mode 2: <Wait for> Mode ---
        await page.click(".tab-wait");
        await page.waitForSelector(".briefly-text-wait, .promise-val");
        await page.waitForSelector(".promise-val");
        const promiseVal = await page.$eval(".promise-val", el => el.textContent.trim());
        assert.equal(promiseVal, "Single Promise Resolved Data");

        // Reload Promise
        await page.click(".btn-reload-promise");
        await page.waitForSelector(".briefly-text-wait");
        await page.waitForSelector(".promise-val");
        const freshVal = await page.$eval(".promise-val", el => el.textContent.trim());
        assert.equal(freshVal, "Fresh Promise Resolved Data");

        // --- Mode 3: <Delay component> Mode ---
        await page.click(".tab-component");
        await page.waitForSelector(".briefly-text-comp, .lazy-widget h3");
        await page.waitForSelector(".lazy-widget h3");
        const widgetHeader = await page.$eval(".lazy-widget h3", el => el.textContent.trim());
        assert.equal(widgetHeader, "Lazy Loaded Component");

        // Fail Lazy Component
        await page.click(".btn-fail-comp");
        await page.waitForSelector(".comp-failed-box h3");
        const compErrHeader = await page.$eval(".comp-failed-box h3", el => el.textContent.trim());
        assert.equal(compErrHeader, "Component Import Failed");

        // Retry Import
        await page.click(".btn-load-comp");
        await page.click(".btn-retry-comp");
        await page.waitForSelector(".lazy-widget h3");
        const retriedHeader = await page.$eval(".lazy-widget h3", el => el.textContent.trim());
        assert.equal(retriedHeader, "Lazy Loaded Component");

        await page.close();
    });

    it("runs dynamic render app (examples/render) testing <Render> component switching, prop & children forwarding, null unmounting, and parent execution count isolation in real browser", async () => {
        const page = await browser.newPage();
        await page.goto(`http://localhost:${PORT}/examples/render/index.html`, {
            waitUntil: "networkidle0"
        });

        // 1. Initial ProfileView rendering
        const profileHeader = await page.$eval(".profile-view h3", el => el.textContent.trim());
        assert.equal(profileHeader, "Profile Component");

        const profileTitle = await page.$eval(".profile-view .prop-title", el => el.textContent.trim());
        assert.equal(profileTitle, "Title: User Account Overview");

        const slottedContent = await page.$eval(".children-content", el => el.textContent.trim());
        assert.equal(slottedContent, "Slotted Content Forwarded");

        // Verify parent execution count is 1
        const initialExec = await page.$eval(".exec-count", el => el.textContent.trim());
        assert.equal(initialExec, "Parent Executions: 1");

        // 2. Switch to SettingsView
        await page.click(".btn-settings");
        const settingsHeader = await page.$eval(".settings-view h3", el => el.textContent.trim());
        assert.equal(settingsHeader, "Settings Component");

        const settingsTitle = await page.$eval(".settings-view .prop-title", el => el.textContent.trim());
        assert.equal(settingsTitle, "Title: User Settings View");

        // Parent execution count must remain 1
        const execAfterSettings = await page.$eval(".exec-count", el => el.textContent.trim());
        assert.equal(execAfterSettings, "Parent Executions: 1");

        // 3. Switch to AnalyticsView
        await page.click(".btn-analytics");
        const analyticsHeader = await page.$eval(".analytics-view h3", el => el.textContent.trim());
        assert.equal(analyticsHeader, "Analytics Component");

        // 4. Unmount component (component = null)
        await page.click(".btn-null");
        const renderedComp = await page.$(".status-box");
        assert.equal(renderedComp, null);

        // Parent execution count remains 1
        const finalExec = await page.$eval(".exec-count", el => el.textContent.trim());
        assert.equal(finalExec, "Parent Executions: 1");

        await page.close();
    });
});
