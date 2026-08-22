import "./setup.js";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    clearRegistry,
    register,
    WithinView,
    Guard,
    Load,
    Place,
    onMount,
    onDestroy,
    setDevMode
} from "../src/index.js";

describe("PrimalJS <WithinView> Viewport-Aware Lifecycle Suite", () => {
    let container;
    let createdObservers = [];
    let mockObserverCallbacks = new Map();

    class MockIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options || {};
            this.observedElements = new Set();
            createdObservers.push(this);
            mockObserverCallbacks.set(this, callback);
        }

        observe(target) {
            this.observedElements.add(target);
        }

        unobserve(target) {
            this.observedElements.delete(target);
        }

        disconnect() {
            this.observedElements.clear();
        }

        // Helper method to trigger intersection in test
        trigger(isIntersecting) {
            const entries = Array.from(this.observedElements).map(target => ({
                isIntersecting,
                target
            }));
            this.callback(entries, this);
        }
    }

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.innerHTML = "";
        document.body.appendChild(container);
        clearRegistry();

        createdObservers = [];
        mockObserverCallbacks.clear();
        window.IntersectionObserver = MockIntersectionObserver;
    });

    afterEach(() => {
        delete window.IntersectionObserver;
    });

    it("1. Child component function is NOT executed before intersection", () => {
        let childExecuted = false;

        function HeavyChild() {
            childExecuted = true;
            return html`<div class="heavy">Heavy Content</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <HeavyChild />
                </WithinView>
            `;
        }

        register(HeavyChild, App);
        mount(App, container);

        assert.equal(childExecuted, false, "Child component function must not execute before viewport intersection");
    });

    it("2. Child mounts after viewport intersection", async () => {
        let childExecuted = false;

        function HeavyChild() {
            childExecuted = true;
            return html`<div class="heavy">Heavy Content</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <HeavyChild />
                </WithinView>
            `;
        }

        register(HeavyChild, App);
        mount(App, container);

        await Promise.resolve(); // Wait for observer registration microtask

        assert.equal(createdObservers.length, 1);
        createdObservers[0].trigger(true);

        assert.equal(childExecuted, true);
        assert.equal(container.querySelector(".heavy").textContent, "Heavy Content");
    });

    it("3. Child component executes ONCE even upon repeated intersection triggers (once=true default)", async () => {
        let executionCount = 0;

        function HeavyChild() {
            executionCount++;
            return html`<div class="heavy">Heavy Content</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <HeavyChild />
                </WithinView>
            `;
        }

        register(HeavyChild, App);
        mount(App, container);

        await Promise.resolve();

        createdObservers[0].trigger(true);
        createdObservers[0].trigger(true);
        createdObservers[0].trigger(true);

        assert.equal(executionCount, 1, "Child component must execute exactly once when once=true");
    });

    it("4. onMount lifecycle hook runs exactly once upon intersection", async () => {
        let mountCount = 0;

        function ChildWithMount() {
            onMount(() => {
                mountCount++;
            });
            return html`<div>Mounted</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <ChildWithMount />
                </WithinView>
            `;
        }

        register(ChildWithMount, App);
        mount(App, container);

        assert.equal(mountCount, 0);

        await Promise.resolve();
        createdObservers[0].trigger(true);

        assert.equal(mountCount, 1, "onMount must execute exactly once upon intersection");
    });

    it("5. onDestroy lifecycle hook runs when parent owner is unmounted", async () => {
        let destroyCount = 0;

        function ChildWithDestroy() {
            onDestroy(() => {
                destroyCount++;
            });
            return html`<div>Destroyable</div>`;
        }

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <WithinView>
                            <ChildWithDestroy />
                        </WithinView>
                    ` : html`<p>Hidden</p>`}
                </div>
            `;
        }

        register(ChildWithDestroy, App);
        mount(App, container);

        await Promise.resolve();
        createdObservers[0].trigger(true);

        assert.equal(destroyCount, 0);
        show.value = false;
        assert.equal(destroyCount, 1, "onDestroy must run when owner is unmounted");
    });

    it("6. Parent destroyed BEFORE intersection disconnects observer and child NEVER mounts/executes", async () => {
        let childExecuted = false;

        function HeavyChild() {
            childExecuted = true;
            return html`<div>Heavy</div>`;
        }

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <WithinView>
                            <HeavyChild />
                        </WithinView>
                    ` : null}
                </div>
            `;
        }

        register(HeavyChild, App);
        mount(App, container);

        await Promise.resolve();
        const obs = createdObservers[0];
        assert.equal(obs.observedElements.size, 1);

        // Destroy parent BEFORE intersection
        show.value = false;

        assert.equal(obs.observedElements.size, 0, "Observer must be disconnected on parent destruction");

        // Stale callback trigger
        obs.trigger(true);
        assert.equal(childExecuted, false, "Child must never mount if parent was destroyed before intersection");
    });

    it("7. Parent destroyed AFTER intersection properly destroys mounted child", async () => {
        let destroyCount = 0;

        function Child() {
            onDestroy(() => destroyCount++);
            return html`<div class="active">Active</div>`;
        }

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <WithinView>
                            <Child />
                        </WithinView>
                    ` : null}
                </div>
            `;
        }

        register(Child, App);
        mount(App, container);

        await Promise.resolve();
        createdObservers[0].trigger(true);
        assert.equal(container.querySelector(".active").textContent, "Active");

        show.value = false;
        assert.equal(destroyCount, 1);
        assert.equal(container.querySelector(".active"), null);
    });

    it("8. margin prop passes correct rootMargin to IntersectionObserver", async () => {
        function App() {
            return html`
                <WithinView margin="200px 50px">
                    <div>Content</div>
                </WithinView>
            `;
        }

        mount(App, container);
        await Promise.resolve();

        assert.equal(createdObservers.length, 1);
        assert.equal(createdObservers[0].options.rootMargin, "200px 50px");
    });

    it("9. threshold prop passes correct threshold to IntersectionObserver", async () => {
        function App() {
            return html`
                <WithinView threshold=${0.5}>
                    <div>Content</div>
                </WithinView>
            `;
        }

        mount(App, container);
        await Promise.resolve();

        assert.equal(createdObservers.length, 1);
        assert.equal(createdObservers[0].options.threshold, 0.5);
    });

    it("10. fallback prop renders fallback content before activation", () => {
        function App() {
            return html`
                <WithinView fallback=${html`<div class="loading-fb">Loading Chart...</div>`}>
                    <div class="real-chart">Chart Loaded</div>
                </WithinView>
            `;
        }

        mount(App, container);

        assert.equal(container.querySelector(".loading-fb").textContent, "Loading Chart...");
        assert.equal(container.querySelector(".real-chart"), null);
    });

    it("11. Fallback content is removed when actual child mounts", async () => {
        function App() {
            return html`
                <WithinView fallback=${html`<div class="loading-fb">Loading Chart...</div>`}>
                    <div class="real-chart">Chart Loaded</div>
                </WithinView>
            `;
        }

        mount(App, container);

        await Promise.resolve();
        createdObservers[0].trigger(true);

        assert.equal(container.querySelector(".loading-fb"), null);
        assert.equal(container.querySelector(".real-chart").textContent, "Chart Loaded");
    });

    it("12. minHeight prop reserves configured placeholder minimum height", () => {
        function App() {
            return html`
                <WithinView minHeight="450px">
                    <div>Content</div>
                </WithinView>
            `;
        }

        mount(App, container);

        const placeholder = container.querySelector("[data-primal-within-view]");
        assert.ok(placeholder);
        assert.equal(placeholder.style.minHeight, "450px");
    });

    it("13. Multiple root children mount correctly without requiring a wrapping <div>", async () => {
        function App() {
            return html`
                <WithinView>
                    <h2 class="title">Header</h2>
                    <p class="desc">Desc</p>
                    <button class="btn">Action</button>
                </WithinView>
            `;
        }

        mount(App, container);
        await Promise.resolve();
        createdObservers[0].trigger(true);

        assert.equal(container.querySelector(".title").textContent, "Header");
        assert.equal(container.querySelector(".desc").textContent, "Desc");
        assert.equal(container.querySelector(".btn").textContent, "Action");
    });

    it("14. Nested <WithinView> components maintain independent observers", async () => {
        let outerMounted = false;
        let innerMounted = false;

        function Outer() {
            outerMounted = true;
            return html`
                <div class="outer">
                    <WithinView margin="100px">
                        <Inner />
                    </WithinView>
                </div>
            `;
        }

        function Inner() {
            innerMounted = true;
            return html`<div class="inner">Inner</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <Outer />
                </WithinView>
            `;
        }

        register(Outer, Inner, App);
        mount(App, container);

        await Promise.resolve();
        assert.equal(createdObservers.length, 1);

        // Trigger outer observer
        createdObservers[0].trigger(true);
        assert.equal(outerMounted, true);
        assert.equal(innerMounted, false);

        await Promise.resolve();
        assert.equal(createdObservers.length, 2);

        // Trigger inner observer
        createdObservers[1].trigger(true);
        assert.equal(innerMounted, true);
    });

    it("15. Multiple <WithinView> instances activate independently", async () => {
        let sec1Mounted = false;
        let sec2Mounted = false;

        function Sec1() { sec1Mounted = true; return html`<div>Sec 1</div>`; }
        function Sec2() { sec2Mounted = true; return html`<div>Sec 2</div>`; }

        function App() {
            return html`
                <div>
                    <WithinView>
                        <Sec1 />
                    </WithinView>
                    <WithinView>
                        <Sec2 />
                    </WithinView>
                </div>
            `;
        }

        register(Sec1, Sec2, App);
        mount(App, container);

        await Promise.resolve();
        assert.equal(createdObservers.length, 2);

        // Trigger only second observer
        createdObservers[1].trigger(true);

        assert.equal(sec1Mounted, false);
        assert.equal(sec2Mounted, true);
    });

    it("16. Unsupported IntersectionObserver mounts children immediately without crashing", () => {
        delete window.IntersectionObserver;
        let childMounted = false;

        function DirectChild() {
            childMounted = true;
            return html`<div class="direct">Direct</div>`;
        }

        function App() {
            return html`
                <WithinView>
                    <DirectChild />
                </WithinView>
            `;
        }

        register(DirectChild, App);
        mount(App, container);

        assert.equal(childMounted, true);
        assert.equal(container.querySelector(".direct").textContent, "Direct");
    });

    it("17. Stale observer callbacks are ignored after parent disposal", async () => {
        let childMounted = false;

        function Child() {
            childMounted = true;
            return html`<div>Content</div>`;
        }

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <WithinView>
                            <Child />
                        </WithinView>
                    ` : null}
                </div>
            `;
        }

        register(Child, App);
        mount(App, container);

        await Promise.resolve();
        const obs = createdObservers[0];

        show.value = false; // Disposes parent

        obs.trigger(true); // Stale callback
        assert.equal(childMounted, false);
    });

    it("18. Errors during delayed child mounting bubble up to logical parent <Guard>", async () => {
        function ThrowingChild() {
            throw new Error("Delayed Mount Error");
        }

        function App() {
            return html`
                <Guard fallback=${(err) => html`<div class="guard-err">Guard: ${err.message}</div>`}>
                    <WithinView>
                        <ThrowingChild />
                    </WithinView>
                </Guard>
            `;
        }

        register(ThrowingChild, App);
        mount(App, container);

        await Promise.resolve();
        createdObservers[0].trigger(true);

        assert.equal(container.querySelector(".guard-err").textContent, "Guard: Delayed Mount Error");
    });

    it("19. <WithinView> inside <Load> cleans up observer/subtree when <Load> switches components", async () => {
        let childMounted = false;
        let childDestroyed = false;

        function CompA() {
            return html`
                <WithinView>
                    <ChildA />
                </WithinView>
            `;
        }

        function ChildA() {
            childMounted = true;
            onDestroy(() => childDestroyed = true);
            return html`<div class="child-a">Child A</div>`;
        }

        function CompB() {
            return html`<div class="comp-b">Comp B</div>`;
        }

        const activeComp = signal(CompA);

        function App() {
            return html`<Load component=${activeComp} />`;
        }

        register(CompA, ChildA, CompB, App);
        mount(App, container);

        await Promise.resolve();
        const obs = createdObservers[0];
        obs.trigger(true);

        assert.equal(childMounted, true);

        // Switch component in Load
        activeComp.value = CompB;

        assert.equal(childDestroyed, true);
        assert.equal(container.querySelector(".child-a"), null);
        assert.equal(container.querySelector(".comp-b").textContent, "Comp B");
    });

    it("20. Supports once=false mode (mounts on enter, unmounts on leave, mounts again on re-enter)", async () => {
        let mountCount = 0;
        let destroyCount = 0;

        function DynamicVisChild() {
            onMount(() => mountCount++);
            onDestroy(() => destroyCount++);
            return html`<div class="dynamic-vis">Vis Child</div>`;
        }

        function App() {
            return html`
                <WithinView once=${false}>
                    <DynamicVisChild />
                </WithinView>
            `;
        }

        register(DynamicVisChild, App);
        mount(App, container);

        await Promise.resolve();
        const obs = createdObservers[0];

        // Enter viewport
        obs.trigger(true);
        assert.equal(container.querySelector(".dynamic-vis").textContent, "Vis Child");
        assert.equal(mountCount, 1);
        assert.equal(destroyCount, 0);

        // Leave viewport
        obs.trigger(false);
        assert.equal(container.querySelector(".dynamic-vis"), null);
        assert.equal(destroyCount, 1);

        // Re-enter viewport
        obs.trigger(true);
        assert.equal(container.querySelector(".dynamic-vis").textContent, "Vis Child");
        assert.equal(mountCount, 2);
    });
});
