import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    clearRegistry,
    register,
    onMount,
    onDestroy,
    OnIdle,
    normalizeIdleTimeout,
    Guard,
    Keep,
    Load,
    Place
} from "../src/index.js";

describe("PrimalJS <OnIdle> Browser Idle-Aware Lifecycle Component Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. Child is NOT created immediately & 2. Child created when idle callback executes", () => {
        let childCreated = 0;
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 123;
        };

        try {
            function Recommendations() {
                childCreated++;
                return html`<section id="recs">Recommendations</section>`;
            }
            register(Recommendations);

            function App() {
                return html`
                    <OnIdle>
                        <Recommendations />
                    </OnIdle>
                `;
            }

            mount(App, container);

            assert.equal(childCreated, 0, "Child must NOT be instantiated before idle callback");
            assert.equal(container.querySelector("#recs"), null);

            // Execute idle callback
            assert.ok(idleCallbackFn, "requestIdleCallback must have registered a callback");
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });

            assert.equal(childCreated, 1, "Child must be instantiated upon idle callback execution");
            assert.equal(container.querySelector("#recs").textContent, "Recommendations");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("3. Child executes exactly once & 4. onMount runs once & 5. Repeated callback does not duplicate child", () => {
        let executions = 0;
        let mountCount = 0;
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 456;
        };

        try {
            function Recs() {
                executions++;
                onMount(() => { mountCount++; });
                return html`<div id="recs-card">Recs</div>`;
            }
            register(Recs);

            function App() {
                return html`
                    <OnIdle>
                        <Recs />
                    </OnIdle>
                `;
            }

            mount(App, container);
            assert.equal(executions, 0);

            // Trigger idle callback
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(executions, 1);
            assert.equal(mountCount, 1);

            // Try to call idleCallbackFn again!
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(executions, 1, "Repeated callback invocation must NOT re-execute child");
            assert.equal(mountCount, 1, "onMount must NOT run again");
            assert.equal(container.querySelectorAll("#recs-card").length, 1, "No duplicate DOM nodes");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("6. timeout is passed correctly to requestIdleCallback & 7. timeout=${0} is preserved & 9. invalid timeout throws TypeError", () => {
        let passedOptions = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb, options) => {
            passedOptions = options;
            return 789;
        };

        try {
            function Recs() { return html`<div>Recs</div>`; }
            register(Recs);

            function App() {
                return html`
                    <OnIdle timeout=${2000}>
                        <Recs />
                    </OnIdle>
                `;
            }

            mount(App, container);
            assert.deepEqual(passedOptions, { timeout: 2000 });

            // Test timeout=0
            passedOptions = null;
            function AppZero() {
                return html`
                    <OnIdle timeout=${0}>
                        <Recs />
                    </OnIdle>
                `;
            }
            mount(AppZero, container);
            assert.deepEqual(passedOptions, { timeout: 0 });

            // Test normalizeIdleTimeout validation
            assert.equal(normalizeIdleTimeout(null), null);
            assert.equal(normalizeIdleTimeout(undefined), null);
            assert.equal(normalizeIdleTimeout(2000), 2000);
            assert.equal(normalizeIdleTimeout(0), 0);
            assert.throws(() => normalizeIdleTimeout(-100), TypeError);
            assert.throws(() => normalizeIdleTimeout("invalid"), TypeError);
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("10. Parent destroyed before idle: cancelIdleCallback called & 11. Child never created & 12. Stale callback does nothing", () => {
        let cancelledId = null;
        let childCreated = 0;
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        const origCancelIdle = window.cancelIdleCallback;

        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 999;
        };
        window.cancelIdleCallback = (id) => {
            cancelledId = id;
        };

        try {
            function Recs() {
                childCreated++;
                return html`<div>Recs</div>`;
            }
            register(Recs);

            const show = signal(true);

            function App() {
                return html`
                    <div>
                        ${() => show.value ? html`
                            <OnIdle>
                                <Recs />
                            </OnIdle>
                        ` : null}
                    </div>
                `;
            }

            mount(App, container);
            assert.equal(childCreated, 0);

            // Destroy parent before idle activation
            show.value = false;
            assert.equal(cancelledId, 999, "cancelIdleCallback must be called on destruction");

            // Execute stale callback
            if (idleCallbackFn) {
                idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });
            }

            assert.equal(childCreated, 0, "Child must NEVER be created after parent destruction");
        } finally {
            window.requestIdleCallback = origRequestIdle;
            window.cancelIdleCallback = origCancelIdle;
        }
    });

    it("13. Parent destroyed after activation: child onDestroy runs once", () => {
        let destroyCount = 0;
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 111;
        };

        try {
            function Recs() {
                onDestroy(() => { destroyCount++; });
                return html`<div id="recs">Recs</div>`;
            }
            register(Recs);

            const show = signal(true);

            function App() {
                return html`
                    <div>
                        ${() => show.value ? html`
                            <OnIdle>
                                <Recs />
                            </OnIdle>
                        ` : null}
                    </div>
                `;
            }

            mount(App, container);
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(destroyCount, 0);

            // Unmount parent after activation
            show.value = false;
            assert.equal(destroyCount, 1, "Child onDestroy must run once when parent is destroyed after activation");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("14. Fallback setTimeout path works when requestIdleCallback is unavailable", async () => {
        let childCreated = 0;

        const origRequestIdle = window.requestIdleCallback;
        delete window.requestIdleCallback; // Simulate missing requestIdleCallback

        try {
            function Recs() {
                childCreated++;
                return html`<div id="recs-fallback">Fallback Recs</div>`;
            }
            register(Recs);

            function App() {
                return html`
                    <OnIdle>
                        <Recs />
                    </OnIdle>
                `;
            }

            mount(App, container);
            assert.equal(childCreated, 0);

            // Wait for setTimeout(1) fallback
            await new Promise(r => setTimeout(r, 20));

            assert.equal(childCreated, 1);
            assert.equal(container.querySelector("#recs-fallback").textContent, "Fallback Recs");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("16. Multiple OnIdle instances remain independent", () => {
        let callbackA = null;
        let callbackB = null;
        let createdA = 0;
        let createdB = 0;

        const origRequestIdle = window.requestIdleCallback;
        let nextId = 1;
        window.requestIdleCallback = (cb) => {
            if (!callbackA) callbackA = cb;
            else callbackB = cb;
            return nextId++;
        };

        try {
            function WidgetA() { createdA++; return html`<div id="wa">A</div>`; }
            function WidgetB() { createdB++; return html`<div id="wb">B</div>`; }
            register(WidgetA, WidgetB);

            function App() {
                return html`
                    <div>
                        <OnIdle><WidgetA /></OnIdle>
                        <OnIdle><WidgetB /></OnIdle>
                    </div>
                `;
            }

            mount(App, container);
            assert.equal(createdA, 0);
            assert.equal(createdB, 0);

            // Trigger only WidgetA callback
            callbackA({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(createdA, 1);
            assert.equal(createdB, 0);

            // Trigger WidgetB callback
            callbackB({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(createdA, 1);
            assert.equal(createdB, 1);
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("17. Multiple root children mount without wrapper & 20. Optional fallback renders initially and disappears after activation", () => {
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 222;
        };

        try {
            function App() {
                return html`
                    <OnIdle fallback=${html`<div id="placeholder">Loading Recs...</div>`}>
                        <h2 id="title">Recs Title</h2>
                        <p id="body">Recs Body</p>
                    </OnIdle>
                `;
            }

            mount(App, container);

            assert.equal(container.querySelector("#placeholder").textContent, "Loading Recs...");
            assert.equal(container.querySelector("#title"), null);

            // Trigger activation
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });

            assert.equal(container.querySelector("#placeholder"), null, "Fallback must disappear after activation");
            assert.equal(container.querySelector("#title").textContent, "Recs Title");
            assert.equal(container.querySelector("#body").textContent, "Recs Body");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("19. Errors during delayed child creation propagate to surrounding <Guard>", () => {
        let idleCallbackFn = null;
        let caughtError = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 333;
        };

        try {
            function BrokenWidget() {
                throw new Error("Broken Widget Error");
            }
            register(BrokenWidget);

            function App() {
                return html`
                    <Guard fallback=${(err) => {
                        caughtError = err;
                        return html`<div id="guard-error">Error: ${err.message}</div>`;
                    }}>
                        <OnIdle>
                            <BrokenWidget />
                        </OnIdle>
                    </Guard>
                `;
            }

            mount(App, container);
            assert.equal(caughtError, null);

            // Trigger activation
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });

            assert.ok(caughtError);
            assert.equal(caughtError.message, "Broken Widget Error");
            assert.equal(container.querySelector("#guard-error").textContent, "Error: Broken Widget Error");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("21. OnIdle inside Keep is not reactivated after kept subtree restore", () => {
        let recsExecutions = 0;
        let idleCallbackFn = null;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            idleCallbackFn = cb;
            return 444;
        };

        try {
            function RecsPage() {
                return html`
                    <OnIdle>
                        ${() => { recsExecutions++; return html`<div id="recs">Recs</div>`; }}
                    </OnIdle>
                `;
            }
            function OtherPage() {
                return html`<div>Other</div>`;
            }

            const activePage = signal(RecsPage);

            function App() {
                return html`
                    <Keep>
                        <Load component=${activePage} />
                    </Keep>
                `;
            }

            mount(App, container);
            assert.equal(recsExecutions, 0);

            // Trigger activation on RecsPage
            idleCallbackFn({ timeRemaining: () => 50, didTimeout: false });
            assert.equal(recsExecutions, 1);

            // Switch away (RecsPage is KEPT) and back
            activePage.value = OtherPage;
            activePage.value = RecsPage;

            assert.equal(recsExecutions, 1, "OnIdle must NOT re-activate or re-execute after kept subtree restoration");
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });

    it("23. 100-instance stress test verifies no duplicate DOM or listener leaks", () => {
        const callbacks = [];
        let totalExecutions = 0;

        const origRequestIdle = window.requestIdleCallback;
        window.requestIdleCallback = (cb) => {
            callbacks.push(cb);
            return callbacks.length;
        };

        try {
            function Item(props) {
                totalExecutions++;
                return html`<div class="idle-item">Item ${props.id}</div>`;
            }
            register(Item);

            function App() {
                const items = Array.from({ length: 100 }, (_, i) => i + 1);
                return html`
                    <div id="stress-container">
                        ${items.map(id => html`
                            <OnIdle>
                                <Item id=${id} />
                            </OnIdle>
                        `)}
                    </div>
                `;
            }

            const app = mount(App, container);
            assert.equal(totalExecutions, 0);
            assert.equal(callbacks.length, 100);

            // Trigger all 100 callbacks!
            for (const cb of callbacks) {
                cb({ timeRemaining: () => 50, didTimeout: false });
            }

            assert.equal(totalExecutions, 100);
            assert.equal(container.querySelectorAll(".idle-item").length, 100);

            // Clean up
            app.dispose();
            assert.equal(container.querySelectorAll(".idle-item").length, 0);
        } finally {
            window.requestIdleCallback = origRequestIdle;
        }
    });
});
