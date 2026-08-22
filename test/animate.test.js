import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    clearRegistry,
    register,
    Animate,
    Guard,
    onMount,
    onDestroy
} from "../src/index.js";

describe("PrimalJS <Animate> DOM Lifecycle Animation Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.innerHTML = "";
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. Initial child mounts normally", () => {
        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out">
                    <div class="panel">Panel Content</div>
                </Animate>
            `;
        }

        mount(App, container);

        assert.equal(container.querySelector(".panel").textContent, "Panel Content");
    });

    it("2. Enter class is applied on mount when appear=true", () => {
        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out">
                    <div class="panel">Panel Content</div>
                </Animate>
            `;
        }

        mount(App, container);

        const panel = container.querySelector(".panel");
        assert.ok(panel.classList.contains("fade-in"));
    });

    it("3. Enter class cleanup works upon animationend", () => {
        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out">
                    <div class="panel">Panel Content</div>
                </Animate>
            `;
        }

        mount(App, container);

        const panel = container.querySelector(".panel");
        assert.ok(panel.classList.contains("fade-in"));

        // Dispatch animationend
        panel.dispatchEvent(new Event("animationend", { bubbles: true }));

        assert.equal(panel.classList.contains("fade-in"), false);
    });

    it("4. Setting condition false does NOT immediately destroy child when leave is configured", () => {
        const visible = signal(true);
        let destroyRan = false;

        function Child() {
            onDestroy(() => destroyRan = true);
            return html`<div class="animated-child">Child</div>`;
        }

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<Child />` : null}
                </Animate>
            `;
        }

        register(Child, App);
        mount(App, container);

        assert.ok(container.querySelector(".animated-child"));

        // Hide child
        visible.value = false;

        // Child MUST NOT be immediately destroyed or removed
        assert.ok(container.querySelector(".animated-child"), "Child DOM must remain during leave phase");
        assert.equal(destroyRan, false, "onDestroy must not run before leave animation completes");
    });

    it("5. Leave class is applied during leave phase", () => {
        const visible = signal(true);

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<div class="dialog">Dialog</div>` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const dialog = container.querySelector(".dialog");
        visible.value = false;

        assert.ok(dialog.classList.contains("fade-out"));
    });

    it("6. onDestroy does not run before leave completion", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function AnimatedWidget() {
            onDestroy(() => destroyCount++);
            return html`<div class="widget">Widget</div>`;
        }

        function App() {
            return html`
                <Animate leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<AnimatedWidget />` : null}
                </Animate>
            `;
        }

        register(AnimatedWidget, App);
        mount(App, container);

        visible.value = false;

        assert.equal(destroyCount, 0, "onDestroy must stay 0 while leave animation runs");
    });

    it("7. animationend event causes final destruction and DOM removal", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function AnimatedWidget() {
            onDestroy(() => destroyCount++);
            return html`<div class="widget">Widget</div>`;
        }

        function App() {
            return html`
                <Animate leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<AnimatedWidget />` : null}
                </Animate>
            `;
        }

        register(AnimatedWidget, App);
        mount(App, container);

        const el = container.querySelector(".widget");
        visible.value = false;
        assert.equal(destroyCount, 0);

        // Dispatch animationend
        el.dispatchEvent(new Event("animationend", { bubbles: true }));

        assert.equal(destroyCount, 1, "onDestroy must run after animationend");
        assert.equal(container.querySelector(".widget"), null, "DOM must be removed after animationend");
    });

    it("8. transitionend event causes final destruction", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function AnimatedWidget() {
            onDestroy(() => destroyCount++);
            return html`<div class="widget">Widget</div>`;
        }

        function App() {
            return html`
                <Animate leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<AnimatedWidget />` : null}
                </Animate>
            `;
        }

        register(AnimatedWidget, App);
        mount(App, container);

        const el = container.querySelector(".widget");
        visible.value = false;

        // Dispatch transitionend
        el.dispatchEvent(new Event("transitionend", { bubbles: true }));

        assert.equal(destroyCount, 1);
        assert.equal(container.querySelector(".widget"), null);
    });

    it("9. onDestroy runs exactly once upon completion", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function AnimatedWidget() {
            onDestroy(() => destroyCount++);
            return html`<div class="widget">Widget</div>`;
        }

        function App() {
            return html`
                <Animate leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<AnimatedWidget />` : null}
                </Animate>
            `;
        }

        register(AnimatedWidget, App);
        mount(App, container);

        const el = container.querySelector(".widget");
        visible.value = false;

        el.dispatchEvent(new Event("animationend", { bubbles: true }));
        el.dispatchEvent(new Event("animationend", { bubbles: true })); // Duplicate event

        assert.equal(destroyCount, 1, "onDestroy must run strictly once");
    });

    it("10. DOM is removed only after leave completes", () => {
        const visible = signal(true);

        function App() {
            return html`
                <Animate leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<div class="modal">Modal</div>` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const el = container.querySelector(".modal");
        visible.value = false;

        assert.equal(container.contains(el), true);

        el.dispatchEvent(new Event("animationend", { bubbles: true }));

        assert.equal(container.contains(el), false);
    });

    it("11. No leave animation means immediate destruction", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function Child() {
            onDestroy(() => destroyCount++);
            return html`<div class="immediate-child">Child</div>`;
        }

        function App() {
            return html`
                <Animate enter="fade-in">
                    ${() => visible.value ? html`<Child />` : null}
                </Animate>
            `;
        }

        register(Child, App);
        mount(App, container);

        visible.value = false;

        assert.equal(destroyCount, 1, "Should destroy immediately if no leave class is defined");
        assert.equal(container.querySelector(".immediate-child"), null);
    });

    it("12. No enter animation means immediate normal appearance", () => {
        function App() {
            return html`
                <Animate leave="fade-out">
                    <div class="no-enter">No Enter Class</div>
                </Animate>
            `;
        }

        mount(App, container);

        const el = container.querySelector(".no-enter");
        assert.ok(el);
        assert.equal(el.className, "no-enter");
    });

    it("13. Leave cancellation (false -> true before animation end) preserves component", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function Child() {
            onDestroy(() => destroyCount++);
            return html`<div class="interrupted">Interrupted</div>`;
        }

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<Child />` : null}
                </Animate>
            `;
        }

        register(Child, App);
        mount(App, container);

        const el = container.querySelector(".interrupted");
        visible.value = false; // Start leave
        assert.ok(el.classList.contains("fade-out"));

        visible.value = true; // Interrupt leave!

        assert.equal(el.classList.contains("fade-out"), false, "fade-out class must be removed on interruption");
        assert.equal(destroyCount, 0, "Component must not be destroyed when leave is interrupted");
    });

    it("14. Stale animationend from cancelled leave does NOT destroy active content", () => {
        const visible = signal(true);
        let destroyCount = 0;

        function Child() {
            onDestroy(() => destroyCount++);
            return html`<div class="stale-test">Stale Test</div>`;
        }

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<Child />` : null}
                </Animate>
            `;
        }

        register(Child, App);
        mount(App, container);

        const el = container.querySelector(".stale-test");
        visible.value = false; // Start leave
        visible.value = true;  // Interrupt leave

        // Stale animationend event fires now
        el.dispatchEvent(new Event("animationend", { bubbles: true }));

        assert.equal(destroyCount, 0, "Stale animationend must not destroy reactivated content");
        assert.ok(container.querySelector(".stale-test"));
    });

    it("15. DOM node identity (before === after) survives cancelled leave", () => {
        const visible = signal(true);

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<div id="identity-item">Identity Item</div>` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const beforeNode = container.querySelector("#identity-item");

        visible.value = false; // Start leave
        visible.value = true;  // Interrupt leave

        const afterNode = container.querySelector("#identity-item");

        assert.equal(beforeNode, afterNode, "DOM node identity MUST be strictly preserved on interrupted leave");
    });

    it("16. 100-iteration rapid toggling stress test", () => {
        const visible = signal(true);
        let mountCount = 0;
        let destroyCount = 0;

        function StressChild() {
            onMount(() => mountCount++);
            onDestroy(() => destroyCount++);
            return html`<div class="stress-item">Stress Item</div>`;
        }

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<StressChild />` : null}
                </Animate>
            `;
        }

        register(StressChild, App);
        mount(App, container);

        for (let i = 0; i < 100; i++) {
            visible.value = i % 2 === 0;
        }

        // Final state: visible.value = false (since i = 99: 99 % 2 !== 0 => false)
        // Finish leave animation
        const el = container.querySelector(".stress-item");
        if (el) {
            el.dispatchEvent(new Event("animationend", { bubbles: true }));
        }

        assert.equal(container.querySelector(".stress-item"), null);
        assert.equal(destroyCount, mountCount, "Mount count and destroy count must match after full teardown");
    });

    it("17. Event listeners do not duplicate during interrupted leave", () => {
        const visible = signal(true);
        let clicks = 0;

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<button class="btn-click" onclick=${() => clicks++}>Click</button>` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const btn = container.querySelector(".btn-click");
        btn.click();
        assert.equal(clicks, 1);

        visible.value = false; // Start leave
        visible.value = true;  // Interrupt leave

        btn.click();
        assert.equal(clicks, 2, "Event listener must be called exactly once per click without duplicate bindings");
    });

    it("18. Signal effects do not duplicate during interrupted leave", () => {
        const visible = signal(true);
        const count = signal(0);
        let effectRuns = 0;

        function ReactiveChild() {
            return html`
                ${() => {
                    effectRuns++;
                    return html`<span>Value: ${count.value}</span>`;
                }}
            `;
        }

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`<ReactiveChild />` : null}
                </Animate>
            `;
        }

        register(ReactiveChild, App);
        mount(App, container);
        assert.equal(effectRuns, 1);

        visible.value = false; // Start leave
        visible.value = true;  // Interrupt leave

        count.value = 5;
        assert.equal(effectRuns, 2, "Effect must run exactly once per signal change");
    });

    it("19. Multiple root element output handles animation classes on all root elements", () => {
        const visible = signal(true);

        function App() {
            return html`
                <Animate enter="fade-in" leave="fade-out" duration=${1000}>
                    ${() => visible.value ? html`
                        <h2 class="title">Title</h2>
                        <p class="desc">Description</p>
                    ` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const title = container.querySelector(".title");
        const desc = container.querySelector(".desc");

        assert.ok(title.classList.contains("fade-in"));
        assert.ok(desc.classList.contains("fade-in"));

        visible.value = false;

        assert.ok(title.classList.contains("fade-out"));
        assert.ok(desc.classList.contains("fade-out"));
    });

    it("20. Nested <Animate> components maintain independent enter/leave lifecycles", () => {
        const outerVis = signal(true);
        const innerVis = signal(true);

        function App() {
            return html`
                <Animate enter="outer-in" leave="outer-out" duration=${1000}>
                    ${() => outerVis.value ? html`
                        <div class="outer-box">
                            <Animate enter="inner-in" leave="inner-out" duration=${1000}>
                                ${() => innerVis.value ? html`<span class="inner-box">Inner</span>` : null}
                            </Animate>
                        </div>
                    ` : null}
                </Animate>
            `;
        }

        mount(App, container);

        const innerSpan = container.querySelector(".inner-box");
        innerVis.value = false; // Leave inner

        assert.ok(innerSpan.classList.contains("inner-out"));
        assert.equal(container.querySelector(".outer-box").classList.contains("outer-out"), false);
    });

    it("21. Parent destruction during leave cleans immediately and safely", () => {
        const parentVis = signal(true);
        const childVis = signal(true);
        let destroyCount = 0;

        function Child() {
            onDestroy(() => destroyCount++);
            return html`<div class="clean-target">Target</div>`;
        }

        function App() {
            return html`
                <div>
                    ${() => parentVis.value ? html`
                        <Animate leave="fade-out" duration=${1000}>
                            ${() => childVis.value ? html`<Child />` : null}
                        </Animate>
                    ` : null}
                </div>
            `;
        }

        register(Child, App);
        mount(App, container);

        childVis.value = false; // Start child leave animation
        assert.equal(destroyCount, 0);

        parentVis.value = false; // Immediately destroy parent owner

        assert.equal(destroyCount, 1, "Child must be destroyed when parent owner is unmounted during leave");
        assert.equal(container.querySelector(".clean-target"), null);
    });

    it("22. Duration fallback eventually destroys subtree if animationend never fires", async () => {
        const visible = signal(true);
        let destroyCount = 0;

        function TimeoutChild() {
            onDestroy(() => destroyCount++);
            return html`<div class="timeout-item">Timeout Item</div>`;
        }

        function App() {
            return html`
                <Animate leave="fade-out" duration=${50}>
                    ${() => visible.value ? html`<TimeoutChild />` : null}
                </Animate>
            `;
        }

        register(TimeoutChild, App);
        mount(App, container);

        visible.value = false;
        assert.equal(destroyCount, 0);

        // Wait for 120ms (longer than fallback duration 50ms + 50ms margin)
        await new Promise(resolve => setTimeout(resolve, 120));

        assert.equal(destroyCount, 1, "Duration fallback timeout must clean up stuck leaving subtree");
        assert.equal(container.querySelector(".timeout-item"), null);
    });

    it("23. Errors during leave routing reach surrounding <Guard>", () => {
        const visible = signal(true);

        function App() {
            return html`
                <Guard fallback=${(err) => html`<div class="guard-err">Guard: ${err.message}</div>`}>
                    <Animate leave="fade-out" duration=${1000}>
                        ${() => visible.value ? html`<div class="normal">Normal</div>` : null}
                    </Animate>
                </Guard>
            `;
        }

        mount(App, container);
        assert.ok(container.querySelector(".normal"));
    });

    it("24. Multiple <Animate> instances operate independently", () => {
        const vis1 = signal(true);
        const vis2 = signal(true);

        function App() {
            return html`
                <div>
                    <Animate leave="leave-1" duration=${1000}>
                        ${() => vis1.value ? html`<div class="item-1">Item 1</div>` : null}
                    </Animate>
                    <Animate leave="leave-2" duration=${1000}>
                        ${() => vis2.value ? html`<div class="item-2">Item 2</div>` : null}
                    </Animate>
                </div>
            `;
        }

        mount(App, container);

        vis1.value = false;

        const item1 = container.querySelector(".item-1");
        const item2 = container.querySelector(".item-2");

        assert.ok(item1.classList.contains("leave-1"));
        assert.equal(item2.classList.contains("leave-2"), false);
    });

    it("25. Optional appear=false skips initial enter animation", () => {
        function App() {
            return html`
                <Animate enter="fade-in" appear=${false}>
                    <div class="no-appear">No Appear</div>
                </Animate>
            `;
        }

        mount(App, container);

        const el = container.querySelector(".no-appear");
        assert.equal(el.classList.contains("fade-in"), false, "Enter class should be skipped on initial mount when appear=false");
    });
});
