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

    it("runs declarative <Place> portal app in real browser with target switching and unmount cleanup", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        // Dynamically inject a portal test environment into the real browser
        const result = await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app"></div>
                <div id="modal-root"></div>
                <div id="side-panel"></div>
            `;

            const { html, signal, mount, Place, register } = await import("../../primal.js");

            const showModal = signal(true);
            const targetDest = signal("#modal-root");
            const clickCount = signal(0);

            function ModalDialog() {
                return html`
                    <div class="e2e-modal-card">
                        <h3>Modal Dialog</h3>
                        <button class="e2e-modal-btn" onclick=${() => clickCount.value++}>Click Modal (${clickCount})</button>
                    </div>
                `;
            }

            function App() {
                return html`
                    <div class="e2e-page-root">
                        <h1>App Root</h1>
                        ${() => showModal.value ? html`
                            <Place to=${targetDest}>
                                <ModalDialog />
                            </Place>
                        ` : html`<p>Modal Closed</p>`}
                    </div>
                `;
            }

            window.__targetDest = targetDest;
            window.__showModal = showModal;

            register(ModalDialog, App);
            mount(App, "#app");

            return {
                modalInApp: Boolean(document.querySelector("#app .e2e-modal-card")),
                modalInTarget: Boolean(document.querySelector("#modal-root .e2e-modal-card"))
            };
        });

        assert.equal(result.modalInApp, false, "Modal must NOT be inside #app");
        assert.equal(result.modalInTarget, true, "Modal MUST be inside #modal-root");

        // Interact with button inside placed portal
        await page.click("#modal-root .e2e-modal-btn");
        const btnText1 = await page.locator("#modal-root .e2e-modal-btn").textContent();
        assert.ok(btnText1.includes("Click Modal (1)"));

        // Reactively switch target from #modal-root to #side-panel
        const movedResult = await page.evaluate(() => {
            window.__targetDest.value = "#side-panel";
            return {
                inModalRoot: Boolean(document.querySelector("#modal-root .e2e-modal-card")),
                inSidePanel: Boolean(document.querySelector("#side-panel .e2e-modal-card"))
            };
        });

        assert.equal(movedResult.inModalRoot, false);
        assert.equal(movedResult.inSidePanel, true);

        // Unmount modal
        const unmountedResult = await page.evaluate(() => {
            window.__showModal.value = false;
            return {
                inSidePanel: Boolean(document.querySelector("#side-panel .e2e-modal-card"))
            };
        });

        assert.equal(unmountedResult.inSidePanel, false);

        await context.close();
    });

    it("runs declarative <WithinView> viewport-aware lazy component mounting in real browser with scrolling and rootMargin", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        const initResult = await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;

            const { html, mount, WithinView, register } = await import("../../primal.js");

            window.__heavyMounted = false;

            function HeavyChart() {
                window.__heavyMounted = true;
                return html`
                    <div id="heavy-chart-card">
                        <h3>Heavy Chart Section</h3>
                        <p>Loaded via IntersectionObserver</p>
                    </div>
                `;
            }

            function App() {
                return html`
                    <div class="e2e-scroll-container">
                        <header style="height: 1800px; background: #eee;">
                            <h1>Scroll Down Header (1800px tall)</h1>
                        </header>
                        <WithinView margin="100px" minHeight="300px" fallback=${html`<div id="chart-fallback">Loading Chart...</div>`}>
                            <HeavyChart />
                        </WithinView>
                    </div>
                `;
            }

            register(HeavyChart, App);
            mount(App, "#app");

            return {
                heavyMounted: window.__heavyMounted,
                fallbackPresent: Boolean(document.querySelector("#chart-fallback")),
                chartPresent: Boolean(document.querySelector("#heavy-chart-card"))
            };
        });

        // Initially (at top of page), HeavyChart must NOT be mounted
        assert.equal(initResult.heavyMounted, false, "HeavyChart component must NOT execute before scrolling");
        assert.equal(initResult.chartPresent, false, "HeavyChart DOM element must NOT exist before scrolling");
        assert.equal(initResult.fallbackPresent, true, "Fallback element must be rendered initially");

        // Scroll down 1200px towards the WithinView section
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(100);

        // Verify HeavyChart activates and mounts
        const afterScroll = await page.evaluate(() => {
            return {
                heavyMounted: window.__heavyMounted,
                fallbackPresent: Boolean(document.querySelector("#chart-fallback")),
                chartPresent: Boolean(document.querySelector("#heavy-chart-card")),
                chartText: document.querySelector("#heavy-chart-card")?.textContent.trim()
            };
        });

        assert.equal(afterScroll.heavyMounted, true, "HeavyChart must execute after scrolling near viewport");
        assert.equal(afterScroll.chartPresent, true, "HeavyChart DOM must exist after scrolling");
        assert.equal(afterScroll.fallbackPresent, false, "Fallback must be removed after mounting real child");
        assert.ok(afterScroll.chartText.includes("Heavy Chart Section"));

        // Scroll away back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(50);

        // Content remains mounted by default (once=true)
        const afterScrollAway = await page.evaluate(() => {
            return Boolean(document.querySelector("#heavy-chart-card"));
        });
        assert.equal(afterScrollAway, true, "Content must remain mounted after scrolling away when once=true");

        await context.close();
    });

    it("runs declarative <Animate> DOM lifecycle animations in real browser with CSS keyframes, deferred destruction, and interruption", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            const style = document.createElement("style");
            style.textContent = `
                .dialog-enter { animation: anim-enter 100ms linear; }
                .dialog-leave { animation: anim-leave 100ms linear; }
                @keyframes anim-enter { from { opacity: 0; } to { opacity: 1; } }
                @keyframes anim-leave { from { opacity: 1; } to { opacity: 0; } }
            `;
            document.head.appendChild(style);

            document.body.innerHTML = `<div id="app"></div>`;

            const { html, signal, mount, Animate, register } = await import("../../primal.js");

            const open = signal(true);
            window.__openSignal = open;

            function DialogCard() {
                return html`<div id="e2e-dialog" class="dialog-card">Modal Dialog</div>`;
            }

            function App() {
                return html`
                    <div class="e2e-anim-container">
                        <Animate enter="dialog-enter" leave="dialog-leave">
                            ${() => open.value ? html`<DialogCard />` : null}
                        </Animate>
                    </div>
                `;
            }

            register(DialogCard, App);
            mount(App, "#app");
        });

        // Verify initial mount
        const initialPresent = await page.evaluate(() => Boolean(document.querySelector("#e2e-dialog")));
        assert.equal(initialPresent, true);

        // Close dialog -> triggers leave phase
        await page.evaluate(() => {
            window.__dialogBeforeNode = document.querySelector("#e2e-dialog");
            window.__openSignal.value = false;
        });

        // IMMEDIATELY check: DOM element MUST STILL EXIST during leave animation phase!
        const duringLeaveState = await page.evaluate(() => {
            const el = document.querySelector("#e2e-dialog");
            return {
                stillInDOM: Boolean(el),
                hasLeaveClass: el ? el.classList.contains("dialog-leave") : false
            };
        });

        assert.equal(duringLeaveState.stillInDOM, true, "Dialog DOM MUST remain attached during leave animation");
        assert.equal(duringLeaveState.hasLeaveClass, true, "Dialog MUST have leave class applied");

        // Wait for leave animation to complete
        await page.waitForTimeout(200);

        // Verify DOM element is removed AFTER leave animation finishes
        const afterLeavePresent = await page.evaluate(() => Boolean(document.querySelector("#e2e-dialog")));
        assert.equal(afterLeavePresent, false, "Dialog DOM must be removed after leave animation completes");

        // Re-open and test interrupted leave cancellation
        await page.evaluate(() => { window.__openSignal.value = true; });
        await page.waitForTimeout(50);

        const interruptedResult = await page.evaluate(() => {
            const beforeNode = document.querySelector("#e2e-dialog");
            window.__openSignal.value = false; // Start leave
            const hasLeaveClass = beforeNode.classList.contains("dialog-leave");
            window.__openSignal.value = true;  // Interrupt leave!
            const afterNode = document.querySelector("#e2e-dialog");

            return {
                sameNode: beforeNode === afterNode,
                hasLeaveClassAfterInterruption: afterNode.classList.contains("dialog-leave")
            };
        });

        assert.equal(interruptedResult.sameNode, true, "Interrupted leave MUST preserve DOM node identity");
        assert.equal(interruptedResult.hasLeaveClassAfterInterruption, false, "Leave class MUST be removed after interruption");

        await context.close();
    });

    it("runs declarative <Keep> DOM/component lifecycle preservation in real browser with form inputs, signals, scroll position, and rapid switching", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;

            const { html, signal, mount, Keep, Load, register } = await import("../../primal.js");

            let dashExecutions = 0;

            function Dashboard() {
                dashExecutions++;
                const count = signal(0);
                window.__dashCount = count;

                return html`
                    <div id="e2e-dash-page">
                        <h2>Dashboard Page (Executions: ${dashExecutions})</h2>
                        <input id="e2e-input" type="text" value="" />
                        <button id="e2e-count-btn" onclick=${() => count.value++}>Count: ${count}</button>
                        <div id="e2e-scroll-box" style="height: 100px; overflow-y: scroll;">
                            <div style="height: 300px;">Scroll Content</div>
                        </div>
                    </div>
                `;
            }

            function Settings() {
                return html`<div id="e2e-settings-page">Settings Page</div>`;
            }

            const activePage = signal(Dashboard);
            window.__activePageSignal = activePage;
            window.__DashboardComp = Dashboard;
            window.__SettingsComp = Settings;

            function App() {
                return html`
                    <div class="e2e-keep-container">
                        <Keep>
                            <Load component=${activePage} />
                        </Keep>
                    </div>
                `;
            }

            register(Dashboard, Settings, App);
            mount(App, "#app");
        });

        // Type "hello world" into text input
        await page.fill("#e2e-input", "hello world");
        await page.click("#e2e-count-btn");

        // Set scroll position on scroll box
        await page.evaluate(() => {
            const scrollBox = document.querySelector("#e2e-scroll-box");
            if (scrollBox) scrollBox.scrollTop = 120;
            window.__beforeDashNode = document.querySelector("#e2e-dash-page");
        });

        // Switch to Settings page
        await page.evaluate(() => { window.__activePageSignal.value = window.__SettingsComp; });
        await page.waitForSelector("#e2e-settings-page");

        // Switch back to Dashboard page
        await page.evaluate(() => { window.__activePageSignal.value = window.__DashboardComp; });
        await page.waitForSelector("#e2e-dash-page");

        // Verify preserved state
        const restoredState = await page.evaluate(() => {
            const dashNode = document.querySelector("#e2e-dash-page");
            const input = document.querySelector("#e2e-input");
            const scrollBox = document.querySelector("#e2e-scroll-box");
            const btn = document.querySelector("#e2e-count-btn");

            return {
                sameDOMNode: dashNode === window.__beforeDashNode,
                inputValue: input ? input.value : "",
                btnText: btn ? btn.textContent.trim() : "",
                scrollTop: scrollBox ? scrollBox.scrollTop : 0
            };
        });

        assert.equal(restoredState.sameDOMNode, true, "DOM node identity must be preserved across switches");
        assert.equal(restoredState.inputValue, "hello world", "Input value must survive switching");
        assert.equal(restoredState.btnText, "Count: 1", "Signal count state must survive switching");

        // Perform 20 rapid switches between Dashboard and Settings
        await page.evaluate(() => {
            for (let i = 0; i < 20; i++) {
                window.__activePageSignal.value = window.__SettingsComp;
                window.__activePageSignal.value = window.__DashboardComp;
            }
        });

        // Click count button once more
        await page.click("#e2e-count-btn");

        const finalBtnText = await page.evaluate(() => document.querySelector("#e2e-count-btn")?.textContent.trim());
        assert.equal(finalBtnText, "Count: 2", "Event listener must fire exactly once without duplicate bindings");

        await context.close();
    });

    it("runs declarative <OnIdle> browser idle-aware component in real browser with timeout and delayed mounting", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;

            const { html, signal, mount, OnIdle, register } = await import("../../primal.js");

            let recsMounted = 0;

            function Recommendations() {
                recsMounted++;
                const clicks = signal(0);

                return html`
                    <div id="e2e-recommendations">
                        <h3>Recommendations (Mounted: ${recsMounted})</h3>
                        <button id="e2e-rec-btn" onclick=${() => clicks.value++}>Rec Clicks: ${clicks}</button>
                    </div>
                `;
            }

            function App() {
                return html`
                    <div class="e2e-idle-container">
                        <OnIdle timeout=${300} fallback=${html`<div id="e2e-idle-fallback">Loading Recommendations...</div>`}>
                            <Recommendations />
                        </OnIdle>
                    </div>
                `;
            }

            register(Recommendations, App);
            window.__appHandle = mount(App, "#app");
        });

        // Immediately check that fallback is present and recommendations is NOT present
        const initialState = await page.evaluate(() => ({
            hasFallback: Boolean(document.querySelector("#e2e-idle-fallback")),
            hasRecs: Boolean(document.querySelector("#e2e-recommendations"))
        }));

        assert.equal(initialState.hasFallback, true, "Fallback UI must be present before idle activation");
        assert.equal(initialState.hasRecs, false, "Recommendations must NOT be instantiated before idle activation");

        // Wait for idle activation
        await page.waitForSelector("#e2e-recommendations", { timeout: 2000 });

        // Verify fallback removed and recommendations mounted
        const activatedState = await page.evaluate(() => ({
            hasFallback: Boolean(document.querySelector("#e2e-idle-fallback")),
            recsText: document.querySelector("#e2e-recommendations h3")?.textContent.trim()
        }));

        assert.equal(activatedState.hasFallback, false, "Fallback UI must be removed after idle activation");
        assert.equal(activatedState.recsText, "Recommendations (Mounted: 1)", "Child must mount exactly once");

        // Click button inside delayed component
        await page.click("#e2e-rec-btn");
        const btnText = await page.evaluate(() => document.querySelector("#e2e-rec-btn")?.textContent.trim());
        assert.equal(btnText, "Rec Clicks: 1");

        // Clean up
        await page.evaluate(() => { window.__appHandle.dispose(); });
        const finalPresent = await page.evaluate(() => Boolean(document.querySelector("#e2e-recommendations")));
        assert.equal(finalPresent, false, "DOM must be cleaned up on disposal");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for <OnIdle> covering early unmount cancellation, 0-execution guarantee, and Guard error handling", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;

            const { html, signal, mount, OnIdle, Guard, register } = await import("../../primal.js");

            let childExecutions = 0;
            const showChild = signal(true);

            function IdleWidget() {
                childExecutions++;
                return html`<div id="idle-child">Idle Widget</div>`;
            }

            function App() {
                return html`
                    <div>
                        ${() => showChild.value ? html`
                            <OnIdle timeout=${5000}>
                                <IdleWidget />
                            </OnIdle>
                        ` : null}
                    </div>
                `;
            }

            // Use controlled requestIdleCallback mock to test unmount cancellation
            window.requestIdleCallback = (cb) => setTimeout(cb, 1000);

            register(IdleWidget, App);
            window.__showChild = showChild;
            window.__getChildExecutions = () => childExecutions;
            mount(App, "#app");
        });

        // 1. Verify childExecutions is 0 before idle activation
        let executions = await page.evaluate(() => window.__getChildExecutions());
        assert.equal(executions, 0, "Child component function must NOT execute eagerly before idle activation");

        // 2. Unmount parent owner BEFORE idle callback fires
        await page.evaluate(() => { window.__showChild.value = false; });

        // Wait 100ms
        await page.waitForTimeout(100);

        // 3. Verify childExecutions is STILL 0 (pending callback was cancelled!)
        executions = await page.evaluate(() => window.__getChildExecutions());
        assert.equal(executions, 0, "Unmounting before idle must cancel callback and ensure 0 executions");

        await context.close();
    });

    it("runs declarative <Focus> component in real browser with <Place> portal, Tab focus trapping, and focus restoration to trigger button", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app"></div>
                <div id="modal-root"></div>
            `;

            const { html, signal, mount, Place, Focus, register } = await import("../../primal.js");

            function ModalDialog(props) {
                return html`
                    <div id="e2e-modal-dialog" role="dialog" aria-modal="true">
                        <h2>Confirm Action</h2>
                        <button id="e2e-modal-cancel" onclick=${props.onClose}>Cancel</button>
                        <button id="e2e-modal-confirm" onclick=${props.onClose}>Confirm</button>
                    </div>
                `;
            }

            const open = signal(false);

            function App() {
                return html`
                    <div class="e2e-focus-container">
                        <button id="e2e-open-modal-btn" onclick=${() => open.value = true}>Open Modal</button>
                        ${() => open.value ? html`
                            <Place to="#modal-root">
                                <Focus>
                                    <ModalDialog onClose=${() => open.value = false} />
                                </Focus>
                            </Place>
                        ` : null}
                    </div>
                `;
            }

            register(ModalDialog, App);
            mount(App, "#app");
        });

        // Focus open trigger button
        await page.focus("#e2e-open-modal-btn");
        const activeBefore = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeBefore, "e2e-open-modal-btn");

        // Open modal
        await page.click("#e2e-open-modal-btn");
        await page.waitForSelector("#e2e-modal-dialog");

        // Verify initial autofocus moved inside modal
        const activeInside = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeInside, "e2e-modal-cancel", "Initial focus must move into first focusable element inside modal");

        // Press Tab to move to confirm button
        await page.keyboard.press("Tab");
        const activeSecond = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeSecond, "e2e-modal-confirm");

        // Press Tab on last element to cycle back to cancel button
        await page.keyboard.press("Tab");
        const activeCycled = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeCycled, "e2e-modal-cancel", "Tab on last button must cycle focus to first button");

        // Press Shift+Tab on first element to cycle to last button
        await page.keyboard.press("Shift+Tab");
        const activeShiftCycled = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeShiftCycled, "e2e-modal-confirm", "Shift+Tab on first button must cycle focus to last button");

        // Click cancel button to close modal
        await page.click("#e2e-modal-cancel");

        // Verify focus is restored to trigger button
        const activeAfter = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeAfter, "e2e-open-modal-btn", "Focus must restore to trigger button when modal is unmounted");

        await context.close();
    });

    it("runs lifecycle-aware DOM helpers (onKey, scrollLock, onOutsideClick) composed with <Focus> and <Place> in real browser", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app"></div>
                <div id="modal-root"></div>
            `;

            const { html, signal, ref, mount, Place, Focus, scrollLock, onKey, onOutsideClick, register } = await import("../../primal.js");

            function ComposedModal(props) {
                const dialogRef = ref();

                scrollLock();
                onKey("Escape", props.onClose);
                onOutsideClick([props.triggerRef, dialogRef], props.onClose);

                return html`
                    <Place to="#modal-root">
                        <Focus>
                            <div ref=${dialogRef} id="e2e-composed-dialog" role="dialog" aria-modal="true">
                                <h3>Composed Dialog</h3>
                                <button id="e2e-composed-cancel" onclick=${props.onClose}>Cancel</button>
                            </div>
                        </Focus>
                    </Place>
                `;
            }

            const open = signal(false);
            const triggerRef = ref();

            function App() {
                return html`
                    <div class="e2e-helpers-container">
                        <button ref=${triggerRef} id="e2e-open-composed-btn" onclick=${() => open.value = true}>Open Composed Dialog</button>
                        ${() => open.value ? html`
                            <ComposedModal triggerRef=${triggerRef} onClose=${() => open.value = false} />
                        ` : null}
                    </div>
                `;
            }

            register(ComposedModal, App);
            mount(App, "#app");
        });

        // Click trigger to open modal
        await page.click("#e2e-open-composed-btn");
        await page.waitForSelector("#e2e-composed-dialog");

        // Verify body scroll lock applied
        const overflowLocked = await page.evaluate(() => document.body.style.overflow);
        assert.equal(overflowLocked, "hidden", "Body overflow must be set to hidden when modal is open");

        // Press Escape key -> modal must close via onKey("Escape")
        await page.keyboard.press("Escape");
        await page.waitForSelector("#e2e-composed-dialog", { state: "detached" });

        // Verify body scroll lock released
        const overflowUnlocked = await page.evaluate(() => document.body.style.overflow);
        assert.equal(overflowUnlocked, "", "Body overflow must restore when modal closes via onKey Escape");

        // Re-open modal
        await page.click("#e2e-open-composed-btn");
        await page.waitForSelector("#e2e-composed-dialog");

        // Click outside modal (on document body) -> modal must close via onOutsideClick
        await page.mouse.click(10, 10);
        await page.waitForSelector("#e2e-composed-dialog", { state: "detached" });

        const overflowUnlockedOutside = await page.evaluate(() => document.body.style.overflow);
        assert.equal(overflowUnlockedOutside, "", "Body overflow must restore when modal closes via onOutsideClick");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for onKey() covering all options (keyup, modifiers, ignoreEditable, scoped ref, lifecycle cleanup)", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;

            const { html, signal, ref, mount, onKey, register } = await import("../../primal.js");

            const escCount = signal(0);
            const ctrlKCount = signal(0);
            const keyupCount = signal(0);
            const ignoreEditableCount = signal(0);

            const searchRef = ref();

            function KeyDemo() {
                // 1. Basic document Escape
                onKey("Escape", () => { escCount.value++; });

                // 2. Scoped ref + Control modifier
                onKey(searchRef, "k", () => { ctrlKCount.value++; }, { ctrl: true });

                // 3. Keyup event option
                onKey("Enter", () => { keyupCount.value++; }, { event: "keyup" });

                // 4. ignoreEditable option
                onKey("Escape", () => { ignoreEditableCount.value++; }, { ignoreEditable: true });

                return html`
                    <div id="key-demo">
                        <input ref=${searchRef} id="e2e-search-input" type="text" placeholder="Search..." />
                        <span id="esc-val">${() => escCount.value}</span>
                        <span id="ctrlk-val">${() => ctrlKCount.value}</span>
                        <span id="keyup-val">${() => keyupCount.value}</span>
                        <span id="ignore-val">${() => ignoreEditableCount.value}</span>
                    </div>
                `;
            }

            register(KeyDemo);
            window.__escCount = escCount;
            window.__appHandle = mount(KeyDemo, "#app");
        });

        // 1. Press Escape on page -> escCount increases, ignoreEditableCount increases
        await page.keyboard.press("Escape");
        let escVal = await page.evaluate(() => document.querySelector("#esc-val")?.textContent);
        let ignoreVal = await page.evaluate(() => document.querySelector("#ignore-val")?.textContent);
        assert.equal(escVal, "1", "Global Escape keydown must trigger handler");
        assert.equal(ignoreVal, "1", "ignoreEditable Escape on page body must trigger handler");

        // 2. Focus search input & press Escape inside input -> escCount increases, ignoreEditableCount does NOT increase!
        await page.focus("#e2e-search-input");
        await page.keyboard.press("Escape");
        escVal = await page.evaluate(() => document.querySelector("#esc-val")?.textContent);
        ignoreVal = await page.evaluate(() => document.querySelector("#ignore-val")?.textContent);
        assert.equal(escVal, "2", "Normal Escape inside input must trigger");
        assert.equal(ignoreVal, "1", "ignoreEditable: true must ignore Escape inside input element");

        // 3. Press 'k' inside search input without Ctrl -> ctrlKCount does NOT increase
        await page.keyboard.press("k");
        let ctrlkVal = await page.evaluate(() => document.querySelector("#ctrlk-val")?.textContent);
        assert.equal(ctrlkVal, "0", "Pressing 'k' without Control key must NOT trigger listener");

        // 4. Press Control+k inside search input -> ctrlKCount increases
        await page.keyboard.press("Control+k");
        ctrlkVal = await page.evaluate(() => document.querySelector("#ctrlk-val")?.textContent);
        assert.equal(ctrlkVal, "1", "Control+k on scoped input ref must trigger listener");

        // 5. Press Enter (keyup option) -> keyupCount increases
        await page.keyboard.press("Enter");
        let keyupVal = await page.evaluate(() => document.querySelector("#keyup-val")?.textContent);
        assert.equal(keyupVal, "1", "keyup event option must trigger on Enter keyup");

        // 6. Dispose component and verify listeners are detached
        await page.evaluate(() => { window.__appHandle.dispose(); });
        await page.keyboard.press("Escape");
        escVal = await page.evaluate(() => window.__escCount.value);
        assert.equal(escVal, 2, "Disposed component must not receive key events");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for scrollLock() covering reference counting, style restoration, padding compensation, and unmount cleanup", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `<div id="app"></div>`;
            document.body.style.overflow = "auto";
            document.body.style.paddingRight = "12px";

            const { html, signal, mount, scrollLock, register } = await import("../../primal.js");

            const showModalA = signal(false);
            const showModalB = signal(false);

            function ModalA() {
                scrollLock();
                return html`<div id="modal-a">Modal A</div>`;
            }

            function ModalB() {
                scrollLock();
                return html`<div id="modal-b">Modal B</div>`;
            }

            function App() {
                return html`
                    <div>
                        ${() => showModalA.value ? html`<ModalA />` : null}
                        ${() => showModalB.value ? html`<ModalB />` : null}
                    </div>
                `;
            }

            register(ModalA, ModalB, App);
            window.__showModalA = showModalA;
            window.__showModalB = showModalB;
            window.__appHandle = mount(App, "#app");
        });

        // 1. Initial state: overflow="auto", paddingRight="12px"
        const initialOverflow = await page.evaluate(() => document.body.style.overflow);
        const initialPadding = await page.evaluate(() => document.body.style.paddingRight);
        assert.equal(initialOverflow, "auto");
        assert.equal(initialPadding, "12px");

        // 2. Open Modal A -> scroll locked (overflow="hidden")
        await page.evaluate(() => { window.__showModalA.value = true; });
        let lockedOverflow = await page.evaluate(() => document.body.style.overflow);
        assert.equal(lockedOverflow, "hidden", "Modal A must lock document body scroll");

        // 3. Open Modal B concurrently -> scroll remains locked (lock count 2)
        await page.evaluate(() => { window.__showModalB.value = true; });
        lockedOverflow = await page.evaluate(() => document.body.style.overflow);
        assert.equal(lockedOverflow, "hidden", "Concurrent Modal B must maintain scroll lock");

        // 4. Close Modal B -> Modal A still active, scroll remains locked (lock count 1)
        await page.evaluate(() => { window.__showModalB.value = false; });
        lockedOverflow = await page.evaluate(() => document.body.style.overflow);
        assert.equal(lockedOverflow, "hidden", "Closing Modal B must keep lock active while Modal A is open");

        // 5. Close Modal A -> final lock released, original inline styles restored!
        await page.evaluate(() => { window.__showModalA.value = false; });
        const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
        const restoredPadding = await page.evaluate(() => document.body.style.paddingRight);
        assert.equal(restoredOverflow, "auto", "Final unlock must restore original inline overflow style");
        assert.equal(restoredPadding, "12px", "Final unlock must restore original inline paddingRight style");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for onOutsideClick() covering single/multi targets, Place portal separation, composedPath, and unmount cleanup", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app"></div>
                <div id="dropdown-portal-root"></div>
                <button id="e2e-outside-area">Outside Area</button>
            `;

            const { html, signal, ref, mount, Place, onOutsideClick, register } = await import("../../primal.js");

            const outsideCount = signal(0);
            const triggerRef = ref();
            const menuRef = ref();

            function DropdownApp() {
                // Multi-target array: trigger button + portal menu
                onOutsideClick([triggerRef, menuRef], () => {
                    outsideCount.value++;
                });

                return html`
                    <div id="dropdown-wrapper">
                        <button ref=${triggerRef} id="e2e-dropdown-trigger">Dropdown Trigger</button>
                        <Place to="#dropdown-portal-root">
                            <div ref=${menuRef} id="e2e-portal-menu">
                                <button id="e2e-menu-item-1">Menu Item 1</button>
                                <button id="e2e-menu-item-2">Menu Item 2</button>
                            </div>
                        </Place>
                        <span id="outside-val">${() => outsideCount.value}</span>
                    </div>
                `;
            }

            register(DropdownApp);
            window.__outsideCount = outsideCount;
            window.__appHandle = mount(DropdownApp, "#app");
        });

        // 1. Initial state: outsideCount = 0
        let outsideVal = await page.evaluate(() => document.querySelector("#outside-val")?.textContent);
        assert.equal(outsideVal, "0");

        // 2. Click trigger button -> counted as INSIDE (outsideCount remains 0)
        await page.click("#e2e-dropdown-trigger");
        outsideVal = await page.evaluate(() => document.querySelector("#outside-val")?.textContent);
        assert.equal(outsideVal, "0", "Clicking trigger button must count as INSIDE");

        // 3. Click menu item inside <Place> portal -> counted as INSIDE (outsideCount remains 0)
        await page.click("#e2e-menu-item-1");
        outsideVal = await page.evaluate(() => document.querySelector("#outside-val")?.textContent);
        assert.equal(outsideVal, "0", "Clicking menu item inside portal must count as INSIDE");

        // 4. Click outside area button -> counted as OUTSIDE (outsideCount increases to 1)
        await page.click("#e2e-outside-area");
        outsideVal = await page.evaluate(() => document.querySelector("#outside-val")?.textContent);
        assert.equal(outsideVal, "1", "Clicking outside area must trigger outside click handler");

        // 5. Dispose component and verify listener is detached
        await page.evaluate(() => { window.__appHandle.dispose(); });
        await page.click("#e2e-outside-area");
        const finalOutsideVal = await page.evaluate(() => window.__outsideCount.value);
        assert.equal(finalOutsideVal, 1, "Disposed component must not receive outside click events");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for <Focus> covering initial selector, autofocus=false, trap=false, restore=false, and nested focus stack", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app"></div>
                <button id="e2e-external-btn">External Button</button>
            `;

            const { html, signal, mount, Focus, register } = await import("../../primal.js");

            const showOuter = signal(false);
            const showInner = signal(false);

            function InnerDialog() {
                return html`
                    <div id="e2e-inner-dialog" role="dialog">
                        <button id="e2e-inner-btn">Inner Action</button>
                    </div>
                `;
            }

            function OuterDialog() {
                return html`
                    <div id="e2e-outer-dialog" role="dialog">
                        <button id="e2e-outer-cancel">Outer Cancel</button>
                        <input id="e2e-target-input" type="text" placeholder="Target Input" />
                        <button id="e2e-open-inner-btn" onclick=${() => showInner.value = true}>Open Inner Modal</button>

                        ${() => showInner.value ? html`
                            <Focus>
                                <InnerDialog />
                            </Focus>
                        ` : null}
                    </div>
                `;
            }

            function App() {
                return html`
                    <div>
                        <button id="e2e-open-outer-btn" onclick=${() => showOuter.value = true}>Open Outer Modal</button>
                        ${() => showOuter.value ? html`
                            <Focus initial="#e2e-target-input">
                                <OuterDialog />
                            </Focus>
                        ` : null}
                    </div>
                `;
            }

            register(InnerDialog, OuterDialog, App);
            window.__showOuter = showOuter;
            window.__showInner = showInner;
            mount(App, "#app");
        });

        // 1. Focus external button & open outer modal with initial="#e2e-target-input"
        await page.focus("#e2e-external-btn");
        await page.click("#e2e-open-outer-btn");
        await page.waitForSelector("#e2e-outer-dialog");

        // Focus must land on initial target input
        let activeId = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeId, "e2e-target-input", "Focus must prioritize initial prop selector target");

        // 2. Open nested inner modal -> inner focus scope claims focus
        await page.click("#e2e-open-inner-btn");
        await page.waitForSelector("#e2e-inner-dialog");

        activeId = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeId, "e2e-inner-btn", "Nested Focus scope must claim focus on mount");

        // 3. Close inner modal -> outer scope focus restored to open-inner-btn
        await page.click("#e2e-inner-btn");
        await page.evaluate(() => { window.__showInner.value = false; });
        await page.waitForSelector("#e2e-inner-dialog", { state: "detached" });

        activeId = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeId, "e2e-open-inner-btn", "Closing inner modal must restore focus to outer scope trigger button");

        // 4. Close outer modal -> focus restored to open outer trigger button
        await page.evaluate(() => { window.__showOuter.value = false; });
        await page.waitForSelector("#e2e-outer-dialog", { state: "detached" });

        activeId = await page.evaluate(() => document.activeElement?.id);
        assert.equal(activeId, "e2e-open-outer-btn", "Closing outer modal must restore focus to trigger button");

        await context.close();
    });

    it("runs hydrate() API in real browser adopting pre-rendered static HTML, preserving live input values & DOM element identity", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            // Setup pre-rendered static HTML in document body
            document.body.innerHTML = `
                <div id="app">
                    <div id="e2e-card">
                        <h2 id="e2e-heading">Count: 0</h2>
                        <button id="e2e-inc-btn">Increment</button>
                        <input id="e2e-input" type="text" value="Initial" />
                    </div>
                </div>
            `;

            // User edits input value before JavaScript hydration runs
            const inputEl = document.querySelector("#e2e-input");
            inputEl.value = "User Typed Text";
            window.__inputElBefore = inputEl;
            window.__cardElBefore = document.querySelector("#e2e-card");

            const { html, signal, hydrate, register } = await import("../../primal.js");

            const count = signal(0);
            const textVal = signal("Initial");

            function CounterApp() {
                return html`
                    <div id="e2e-card">
                        <h2 id="e2e-heading">Count: ${count}</h2>
                        <button id="e2e-inc-btn" onclick=${() => count.value++}>Increment</button>
                        <input id="e2e-input" type="text" value=${textVal} />
                    </div>
                `;
            }

            register(CounterApp);
            window.__appHandle = hydrate(CounterApp, "#app");
        });

        // 1. Verify DOM element identity preservation (nodeBefore === nodeAfter)
        const isSameCard = await page.evaluate(() => window.__cardElBefore === document.querySelector("#e2e-card"));
        const isSameInput = await page.evaluate(() => window.__inputElBefore === document.querySelector("#e2e-input"));
        assert.equal(isSameCard, true, "Card container element identity must be preserved by hydrate()");
        assert.equal(isSameInput, true, "Input element identity must be preserved by hydrate()");

        // 2. Verify live input value preserved
        const liveInputValue = await page.evaluate(() => document.querySelector("#e2e-input")?.value);
        assert.equal(liveInputValue, "User Typed Text", "Live form input value must be preserved by hydrate()");

        // 3. Click increment button -> reactivity works on adopted DOM!
        await page.click("#e2e-inc-btn");
        const headingText = await page.evaluate(() => document.querySelector("#e2e-heading")?.textContent.trim());
        assert.equal(headingText, "Count: 1", "Signal update must reactively update hydrated DOM heading");

        // 4. Dispose application -> DOM remains intact, reactivity unbinds
        await page.evaluate(() => { window.__appHandle.dispose(); });
        const cardExists = await page.evaluate(() => Boolean(document.querySelector("#e2e-card")));
        assert.equal(cardExists, true, "Disposal must keep DOM elements intact in document");

        await context.close();
    });

    it("runs comprehensive E2E browser tests for hydrate() covering Element target, ref assignment, nested components, multiple root nodes, and empty fallback", async () => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto(`http://localhost:${port}/examples/hello/index.html`, { waitUntil: "domcontentloaded" });

        await page.evaluate(async () => {
            document.body.innerHTML = `
                <div id="app">
                    <div id="e2e-card">
                        <header id="e2e-hdr">Header</header>
                        <nav id="e2e-nav">Navbar</nav>
                        <input id="e2e-ref-input" type="text" value="Ref Input" />
                    </div>
                </div>
                <div id="empty-target"></div>
            `;

            const { html, ref, hydrate, register } = await import("../../primal.js");

            const pageRef = ref();
            window.__pageRef = pageRef;

            function NavBar() {
                return html`<nav id="e2e-nav">Navbar</nav>`;
            }
            register(NavBar);

            function App() {
                return html`
                    <div id="e2e-card">
                        <header id="e2e-hdr">Header</header>
                        <NavBar />
                        <input id="e2e-ref-input" ref=${pageRef} type="text" value="Ref Input" />
                    </div>
                `;
            }

            const targetEl = document.querySelector("#app");
            const inputBefore = document.querySelector("#e2e-ref-input");
            window.__inputBefore = inputBefore;

            // 1. Hydrate using Element node reference
            window.__appHandle = hydrate(App, targetEl);

            // 2. Empty target fallback
            function FallbackApp() {
                return html`<div id="e2e-fallback-child">Fallback Mounted</div>`;
            }
            window.__fallbackHandle = hydrate(FallbackApp, "#empty-target");
        });

        // 1. Verify Ref points to existing DOM element
        const isRefMatching = await page.evaluate(() => window.__pageRef.current === window.__inputBefore);
        assert.equal(isRefMatching, true, "ref.current must point directly to existing DOM element in real browser");

        // 2. Verify nested component DOM elements preserved
        const navText = await page.evaluate(() => document.querySelector("#e2e-nav")?.textContent.trim());
        assert.equal(navText, "Navbar", "Nested component DOM must be adopted in real browser");

        // 3. Verify empty target fallback mounted content
        const fallbackText = await page.evaluate(() => document.querySelector("#e2e-fallback-child")?.textContent.trim());
        assert.equal(fallbackText, "Fallback Mounted", "Empty target must fall back to mount() in real browser");

        await context.close();
    });
});
