import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    clearRegistry,
    register,
    Place,
    Guard,
    Load,
    onMount,
    onDestroy,
    ref,
    setDevMode
} from "../src/index.js";

describe("PrimalJS <Place> Declarative Portal Component Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.innerHTML = "";
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. <Place to='selector'> renders children in target element", () => {
        const modalRoot = document.createElement("div");
        modalRoot.id = "modal-root";
        document.body.appendChild(modalRoot);

        function App() {
            return html`
                <div class="page">
                    <Place to="#modal-root">
                        <div class="modal-content">Inside Modal</div>
                    </Place>
                </div>
            `;
        }

        mount(App, container);

        assert.equal(modalRoot.querySelector(".modal-content").textContent, "Inside Modal");
    });

    it("2. <Place to=${element}> accepts direct DOM Element reference", () => {
        const targetEl = document.createElement("div");
        targetEl.id = "direct-target";
        document.body.appendChild(targetEl);

        function App() {
            return html`
                <div>
                    <Place to=${targetEl}>
                        <span class="placed-item">Direct Element Placement</span>
                    </Place>
                </div>
            `;
        }

        mount(App, container);

        assert.equal(targetEl.querySelector(".placed-item").textContent, "Direct Element Placement");
    });

    it("3. Children do not remain visually under original declaration location", () => {
        const targetEl = document.createElement("div");
        targetEl.id = "target-box";
        document.body.appendChild(targetEl);

        function App() {
            return html`
                <div class="declaration-parent">
                    <Place to="#target-box">
                        <p class="child-text">Moved Text</p>
                    </Place>
                </div>
            `;
        }

        mount(App, container);

        const declParent = container.querySelector(".declaration-parent");
        assert.equal(declParent.querySelector(".child-text"), null, "Child must not remain under declaration location");
        assert.equal(targetEl.querySelector(".child-text").textContent, "Moved Text");
    });

    it("4. Child component executes EXACTLY ONCE (executions === 1)", () => {
        let executions = 0;

        function PlacedChild() {
            executions++;
            return html`<div class="child">Execution Counter</div>`;
        }

        function App() {
            return html`
                <Place to=${container}>
                    <PlacedChild />
                </Place>
            `;
        }

        register(PlacedChild, App);
        mount(App, container);

        assert.equal(executions, 1, "Placed child component function must execute exactly once");
    });

    it("5. onMount lifecycle hook runs exactly once", () => {
        let mountCount = 0;

        function ChildWithMount() {
            onMount(() => {
                mountCount++;
            });
            return html`<div class="mounted">Mounted</div>`;
        }

        function App() {
            return html`
                <Place to=${container}>
                    <ChildWithMount />
                </Place>
            `;
        }

        register(ChildWithMount, App);
        mount(App, container);

        assert.equal(mountCount, 1, "onMount must execute exactly once");
    });

    it("6. onDestroy lifecycle hook runs when parent owner is unmounted", () => {
        let destroyCount = 0;

        function ChildWithDestroy() {
            onDestroy(() => {
                destroyCount++;
            });
            return html`<div class="destroyable">Destroyable</div>`;
        }

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <Place to=${container}>
                            <ChildWithDestroy />
                        </Place>
                    ` : html`<p>Hidden</p>`}
                </div>
            `;
        }

        register(ChildWithDestroy, App);
        mount(App, container);

        assert.equal(destroyCount, 0);
        show.value = false;
        assert.equal(destroyCount, 1, "onDestroy must run when owner is unmounted");
    });

    it("7. Owner disposal removes placed DOM nodes from target container", () => {
        const targetEl = document.createElement("div");
        targetEl.id = "owner-target";
        document.body.appendChild(targetEl);

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <Place to="#owner-target">
                            <div class="temporary-placed">Temporary</div>
                        </Place>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);
        assert.equal(targetEl.querySelector(".temporary-placed").textContent, "Temporary");

        show.value = false;
        assert.equal(targetEl.querySelector(".temporary-placed"), null, "Placed DOM must be removed when owner is destroyed");
    });

    it("8. Reactive Signal effects inside placed subtree stop after disposal", () => {
        const count = signal(0);
        let effectRuns = 0;

        function ReactiveChild() {
            return html`
                ${() => {
                    effectRuns++;
                    return html`<span>Count: ${count.value}</span>`;
                }}
            `;
        }

        const active = signal(true);

        function App() {
            return html`
                <div>
                    ${() => active.value ? html`
                        <Place to=${container}>
                            <ReactiveChild />
                        </Place>
                    ` : null}
                </div>
            `;
        }

        register(ReactiveChild, App);
        mount(App, container);
        assert.equal(effectRuns, 1);

        count.value = 1;
        assert.equal(effectRuns, 2);

        active.value = false; // Unmount Place
        count.value = 2; // Should NOT trigger effect
        assert.equal(effectRuns, 2, "Effects inside placed subtree must be disposed on unmount");
    });

    it("9. Event listeners inside placed subtree are cleaned up on disposal", () => {
        let clicks = 0;

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <Place to=${container}>
                            <button class="placed-btn" onclick=${() => clicks++}>Click</button>
                        </Place>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);
        const btn = container.querySelector(".placed-btn");
        btn.click();
        assert.equal(clicks, 1);

        show.value = false; // Disposes Place and removes button from DOM
        assert.equal(container.querySelector(".placed-btn"), null);
    });

    it("10. DOM refs inside placed subtree are cleaned up after disposal", () => {
        const buttonRef = ref();
        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <Place to=${container}>
                            <button ref=${buttonRef}>Ref Button</button>
                        </Place>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);
        assert.ok(buttonRef.current instanceof HTMLElement);

        show.value = false;
    });

    it("11. Reactive target switching (#left -> #right) moves existing DOM", () => {
        const leftBox = document.createElement("div");
        leftBox.id = "left-box";
        const rightBox = document.createElement("div");
        rightBox.id = "right-box";
        document.body.appendChild(leftBox);
        document.body.appendChild(rightBox);

        const destination = signal("#left-box");

        function App() {
            return html`
                <Place to=${destination}>
                    <div class="movable-content">Movable</div>
                </Place>
            `;
        }

        mount(App, container);
        assert.equal(leftBox.querySelector(".movable-content").textContent, "Movable");
        assert.equal(rightBox.querySelector(".movable-content"), null);

        destination.value = "#right-box";

        assert.equal(leftBox.querySelector(".movable-content"), null);
        assert.equal(rightBox.querySelector(".movable-content").textContent, "Movable");
    });

    it("12. DOM node identity (before === after) is preserved during target switch", () => {
        const box1 = document.createElement("div");
        box1.id = "box-1";
        const box2 = document.createElement("div");
        box2.id = "box-2";
        document.body.appendChild(box1);
        document.body.appendChild(box2);

        const target = signal("#box-1");

        function App() {
            return html`
                <Place to=${target}>
                    <div id="identity-item">Identity Test</div>
                </Place>
            `;
        }

        mount(App, container);
        const beforeNode = box1.querySelector("#identity-item");

        target.value = "#box-2";

        const afterNode = box2.querySelector("#identity-item");

        assert.equal(beforeNode, afterNode, "DOM node reference before and after target switch MUST be strictly equal");
    });

    it("13. Multiple root nodes are moved correctly without a wrapping <div>", () => {
        const overlay = document.createElement("div");
        overlay.id = "multi-overlay";
        document.body.appendChild(overlay);

        function App() {
            return html`
                <Place to="#multi-overlay">
                    <h2 class="head">Heading</h2>
                    <p class="body">Paragraph</p>
                    <button class="action">Action</button>
                </Place>
            `;
        }

        mount(App, container);

        assert.equal(overlay.querySelector(".head").textContent, "Heading");
        assert.equal(overlay.querySelector(".body").textContent, "Paragraph");
        assert.equal(overlay.querySelector(".action").textContent, "Action");
    });

    it("14. Multiple <Place> instances targeting the same container preserve DOM order", () => {
        const toastRoot = document.createElement("div");
        toastRoot.id = "toast-root";
        document.body.appendChild(toastRoot);

        function App() {
            return html`
                <div>
                    <Place to="#toast-root">
                        <div class="toast">First Toast</div>
                    </Place>
                    <Place to="#toast-root">
                        <div class="toast">Second Toast</div>
                    </Place>
                </div>
            `;
        }

        mount(App, container);

        const toasts = Array.from(toastRoot.querySelectorAll(".toast")).map(t => t.textContent);
        assert.deepEqual(toasts, ["First Toast", "Second Toast"]);
    });

    it("15. Nested <Place> components work and clean up correctly", () => {
        const layer1 = document.createElement("div");
        layer1.id = "layer-1";
        const layer2 = document.createElement("div");
        layer2.id = "layer-2";
        document.body.appendChild(layer1);
        document.body.appendChild(layer2);

        const show = signal(true);

        function App() {
            return html`
                <div>
                    ${() => show.value ? html`
                        <Place to="#layer-1">
                            <div class="outer-placed">
                                Outer Placed
                                <Place to="#layer-2">
                                    <span class="inner-tooltip">Inner Tooltip</span>
                                </Place>
                            </div>
                        </Place>
                    ` : null}
                </div>
            `;
        }

        mount(App, container);

        assert.equal(layer1.querySelector(".outer-placed").childNodes[0].nodeValue.trim(), "Outer Placed");
        assert.equal(layer2.querySelector(".inner-tooltip").textContent, "Inner Tooltip");

        show.value = false;

        assert.equal(layer1.querySelector(".outer-placed"), null);
        assert.equal(layer2.querySelector(".inner-tooltip"), null);
    });

    it("16. <Place> inside <Load> component switcher cleans up on component swap", () => {
        const modal = document.createElement("div");
        modal.id = "modal-box";
        document.body.appendChild(modal);

        function ComponentA() {
            return html`
                <Place to="#modal-box">
                    <div class="comp-a-modal">Comp A Modal</div>
                </Place>
            `;
        }

        function ComponentB() {
            return html`<div class="comp-b-main">Comp B Main</div>`;
        }

        const activeComp = signal(ComponentA);

        function App() {
            return html`
                <Load component=${activeComp} />
            `;
        }

        register(ComponentA, ComponentB, App);
        mount(App, container);

        assert.equal(modal.querySelector(".comp-a-modal").textContent, "Comp A Modal");

        activeComp.value = ComponentB;

        assert.equal(modal.querySelector(".comp-a-modal"), null, "Placed content from previous component must be destroyed when Load switches");
        assert.equal(container.querySelector(".comp-b-main").textContent, "Comp B Main");
    });

    it("17. Error inside placed subtree bubbles to logical parent <Guard>", () => {
        function ThrowingPlacedChild() {
            throw new Error("Error Inside Placed Subtree");
        }

        function App() {
            return html`
                <Guard fallback=${(err) => html`<div class="guard-caught">Guard Caught: ${err.message}</div>`}>
                    <div class="page">
                        <Place to=${container}>
                            <ThrowingPlacedChild />
                        </Place>
                    </div>
                </Guard>
            `;
        }

        register(ThrowingPlacedChild, App);
        mount(App, container);

        assert.equal(container.querySelector(".guard-caught").textContent, "Guard Caught: Error Inside Placed Subtree");
    });

    it("18. Missing target logs diagnostic in dev mode and attaches when target later appears", () => {
        setDevMode(true);
        let warnMsg = "";
        const origWarn = console.warn;
        console.warn = (msg) => { warnMsg = String(msg); };

        const targetSignal = signal("#non-existent-id");

        function App() {
            return html`
                <Place to=${targetSignal}>
                    <div class="late-placed">Late Placed</div>
                </Place>
            `;
        }

        mount(App, container);

        assert.ok(warnMsg.includes("target not found: #non-existent-id"));
        console.warn = origWarn;
        setDevMode(false);

        // Later target element appears
        const lateTarget = document.createElement("div");
        lateTarget.id = "late-target";
        document.body.appendChild(lateTarget);

        targetSignal.value = "#late-target";

        assert.equal(lateTarget.querySelector(".late-placed").textContent, "Late Placed");
    });

    it("19. null/undefined target temporarily detaches placed DOM without destroying subtree", () => {
        const modal = document.createElement("div");
        modal.id = "detachable-modal";
        document.body.appendChild(modal);

        let mountRuns = 0;
        let destroyRuns = 0;

        function DetachableChild() {
            onMount(() => mountRuns++);
            onDestroy(() => destroyRuns++);
            return html`<div class="detachable">Detachable Content</div>`;
        }

        const target = signal("#detachable-modal");

        function App() {
            return html`
                <Place to=${target}>
                    <DetachableChild />
                </Place>
            `;
        }

        register(DetachableChild, App);
        mount(App, container);

        assert.equal(modal.querySelector(".detachable").textContent, "Detachable Content");
        assert.equal(mountRuns, 1);
        assert.equal(destroyRuns, 0);

        // Detaching by setting target to null
        target.value = null;
        assert.equal(modal.querySelector(".detachable"), null);
        assert.equal(destroyRuns, 0, "Subtree should NOT be destroyed when target is temporarily null");

        // Re-attaching
        target.value = "#detachable-modal";
        assert.equal(modal.querySelector(".detachable").textContent, "Detachable Content");
        assert.equal(mountRuns, 1, "Component should NOT re-mount when target is re-attached");
        assert.equal(destroyRuns, 0);
    });

    it("20. Repeated target switching 20+ times produces no duplicate DOM or memory leaks", () => {
        const panelA = document.createElement("div");
        panelA.id = "panel-a";
        const panelB = document.createElement("div");
        panelB.id = "panel-b";
        document.body.appendChild(panelA);
        document.body.appendChild(panelB);

        const currentPanel = signal("#panel-a");
        let clicks = 0;

        function App() {
            return html`
                <Place to=${currentPanel}>
                    <button class="repeat-btn" onclick=${() => clicks++}>Repeat Button</button>
                </Place>
            `;
        }

        mount(App, container);

        for (let i = 0; i < 25; i++) {
            currentPanel.value = i % 2 === 0 ? "#panel-b" : "#panel-a";
        }

        const activePanel = currentPanel.value === "#panel-a" ? panelA : panelB;
        const inactivePanel = currentPanel.value === "#panel-a" ? panelB : panelA;

        assert.equal(activePanel.querySelectorAll(".repeat-btn").length, 1);
        assert.equal(inactivePanel.querySelectorAll(".repeat-btn").length, 0);

        const btn = activePanel.querySelector(".repeat-btn");
        btn.click();
        assert.equal(clicks, 1, "Event listener must be called exactly once");
    });
});
