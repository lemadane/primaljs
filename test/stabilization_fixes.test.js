import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal } from "../src/signal.js";
import { html } from "../src/html.js";
import { mount, unmount } from "../src/load.js";
import { activate, hydrate } from "../src/activate.js";
import { head } from "../src/seo.js";
import { createRouter, RouteOutlet } from "../src/router.js";
import { createApp } from "../src/app.js";
import { setupPwa, unregisterServiceWorkers } from "../src/pwa.js";
import { Delay, TimeoutError } from "../src/async.js";
import { WithinView } from "../src/within-view.js";
import { Place } from "../src/place.js";
import { scrollLock, _resetScrollLockStateForTest } from "../src/scroll-lock.js";
import { ComponentContext, pushContext, popContext, deactivateContext } from "../src/lifecycle.js";

describe("PrimalJS 0.4.0-beta Stabilization & Bug Fix Regression Suite", () => {
    it("1. <Delay> stale-Promise resolution does not cancel superseded task's timeout", async () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = "";

        const taskTrigger = signal(1);
        let task2TimedOut = false;
        let resolveTask1;

        function AsyncApp() {
            return html`
                <Delay task=${({ signal: abortSignal }) => {
                    const currentId = taskTrigger.value;
                    if (currentId === 1) {
                        return new Promise(res => { resolveTask1 = res; });
                    } else {
                        return new Promise((res, rej) => {
                            if (abortSignal) {
                                abortSignal.addEventListener("abort", () => {
                                    if (abortSignal.reason instanceof TimeoutError) {
                                        task2TimedOut = true;
                                    }
                                });
                            }
                        });
                    }
                }} timeout=${50} Failed=${(err) => {
                    if (err instanceof TimeoutError) task2TimedOut = true;
                    return html`<span>Timed Out</span>`;
                }}>
                    <span>Loaded</span>
                </Delay>
            `;
        }

        const handle = mount(AsyncApp, appEl);
        await new Promise(r => setTimeout(r, 10));

        // Task 1 started. Switch to Task 2 before Task 1 resolves.
        taskTrigger.value = 2;
        await new Promise(r => setTimeout(r, 10));

        // Task 1 resolves LATE. Must NOT clear Task 2's timeout timer!
        if (resolveTask1) resolveTask1("task 1 late result");
        await new Promise(r => setTimeout(r, 80));

        assert.equal(task2TimedOut, true, "Task 2 timeout should still fire even after Task 1 resolved late");
        handle.dispose();
    });

    it("2. <WithinView once=\${false}> maintains observer target and supports re-entry cycles", async () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = "";

        let activeObserverCallback = null;
        const OriginalObserver = window.IntersectionObserver;

        window.IntersectionObserver = class MockIntersectionObserver {
            constructor(cb, options) {
                activeObserverCallback = cb;
                this.options = options;
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        globalThis.IntersectionObserver = window.IntersectionObserver;

        let mountCount = 0;
        function Child() {
            mountCount++;
            return html`<div>Child Content ${mountCount}</div>`;
        }

        const handle = mount(() => html`<WithinView once=${false}>${Child}</WithinView>`, appEl);
        await new Promise(r => setTimeout(r, 50));

        const placeholder = appEl.querySelector("[data-primal-within-view]");
        assert.ok(placeholder, "Placeholder element must exist in DOM");
        assert.ok(activeObserverCallback, "IntersectionObserver callback must be captured");

        // First viewport entry
        activeObserverCallback([{ isIntersecting: true, target: placeholder }]);
        assert.equal(mountCount, 1);
        assert.ok(appEl.textContent.includes("Child Content 1"));
        assert.ok(placeholder.parentNode, "Placeholder must remain in DOM for once=false");

        // Viewport exit
        activeObserverCallback([{ isIntersecting: false, target: placeholder }]);
        assert.ok(!appEl.textContent.includes("Child Content 1"));

        // Second viewport entry (re-entry)
        activeObserverCallback([{ isIntersecting: true, target: placeholder }]);
        assert.equal(mountCount, 2);
        assert.ok(appEl.textContent.includes("Child Content 2"));

        handle.dispose();
        window.IntersectionObserver = OriginalObserver;
        globalThis.IntersectionObserver = OriginalObserver;
    });

    it("3. hydrate() fallback to mount() on empty target preserves initial props and options", () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = ""; // Empty container

        let receivedProps = null;

        function App(props) {
            receivedProps = props;
            return html`<h1>User: ${props.username}</h1>`;
        }

        const customOnError = () => {};

        const handle = hydrate(App, appEl, { username: "Mel" }, { onError: customOnError });

        assert.ok(receivedProps, "Initial props must be passed to Component on fallback");
        assert.equal(receivedProps.username, "Mel");
        assert.ok(appEl.textContent.includes("User: Mel"));

        handle.dispose();
    });

    it("4. scrollLock(target) respects target element and reference counts without double-decrement", () => {
        _resetScrollLockStateForTest();

        const sidebar = document.createElement("div");
        sidebar.style.overflow = "auto";
        document.body.appendChild(sidebar);

        // Lock specific container element
        const unlockSidebar = scrollLock(sidebar);
        assert.equal(sidebar.style.overflow, "hidden");
        assert.notEqual(document.body.style.overflow, "hidden", "Body should not be locked when targeting sidebar");

        // Test lifecycle hooks deactivation/destruction reference count safety
        const ctx = new ComponentContext("LockTest");
        pushContext(ctx);
        const unlockCtx = scrollLock();
        popContext();

        assert.equal(document.body.style.overflow, "hidden");

        // Deactivate component context (temporary release)
        deactivateContext(ctx);
        assert.notEqual(document.body.style.overflow, "hidden");

        // Unlock manually while deactivated
        unlockCtx();

        // Destroy component context
        ctx.dispose();

        // Must not crash or double-release global count below 0
        assert.notEqual(document.body.style.overflow, "hidden");

        unlockSidebar();
        assert.equal(sidebar.style.overflow, "auto");
        document.body.removeChild(sidebar);
    });

    it("5. createRouter({ mode: 'hash' }) supports hash navigation and routing", async () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = "";

        const router = createRouter({
            mode: "hash",
            routes: [
                { path: "/", component: () => html`<div>Home</div>` },
                { path: "/about", component: () => html`<div>About Page</div>` }
            ]
        });

        const app = createApp({ router });
        app.mount(appEl);

        assert.ok(appEl.textContent.includes("Home"));

        router.navigate("/about");
        await new Promise(r => setTimeout(r, 10));

        assert.equal(window.location.hash, "#/about");
        assert.ok(appEl.textContent.includes("About Page"));

        app.dispose();
    });

    it("6. setupPwa defaults updateStrategy to 'auto' and invokes onOfflineReady callback", async () => {
        let registeredSw = null;
        let offlineReadyFired = false;
        let stateChangeCallback = null;

        const mockWorker = {
            state: "installing",
            set onstatechange(fn) {
                stateChangeCallback = fn;
            },
            get onstatechange() {
                return stateChangeCallback;
            }
        };
        const mockReg = {
            installing: mockWorker,
            waiting: null,
            active: null
        };

        const mockServiceWorkerObj = {
            controller: null, // First install (no existing controller)
            register: async (swPath) => {
                registeredSw = swPath;
                return mockReg;
            }
        };

        Object.defineProperty(window.navigator, "serviceWorker", {
            value: mockServiceWorkerObj,
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            value: mockServiceWorkerObj,
            configurable: true,
            writable: true
        });

        setupPwa({
            swPath: "./custom-sw.js",
            onOfflineReady: () => { offlineReadyFired = true; }
        });

        for (let i = 0; i < 10; i++) {
            if (stateChangeCallback) break;
            await new Promise(r => setTimeout(r, 20));
        }

        assert.equal(registeredSw, "./custom-sw.js");

        // Simulate worker installation completion
        mockWorker.state = "installed";
        if (stateChangeCallback) {
            stateChangeCallback();
        }

        assert.equal(offlineReadyFired, true, "onOfflineReady must be called when service worker is installed");
    });

    it("7. <Place to=\${fragment}> removes nodes from document when unmounted", () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = "";

        const fragment = document.createDocumentFragment();
        const targetContainer = document.createElement("div");
        document.body.appendChild(targetContainer);

        function PortalApp() {
            return html`<Place to=${fragment}><span>Portal Content</span></Place>`;
        }

        const handle = mount(PortalApp, appEl);

        // Append fragment to real DOM container
        targetContainer.appendChild(fragment);
        assert.ok(targetContainer.textContent.includes("Portal Content"));

        // Dispose portal -> must remove nodes from targetContainer
        handle.dispose();
        assert.ok(!targetContainer.textContent.includes("Portal Content"));

        document.body.removeChild(targetContainer);
    });
});
