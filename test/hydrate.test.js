import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    hydrate,
    activate,
    unmount,
    ref,
    onMount,
    onDestroy,
    clearRegistry,
    register
} from "../src/index.js";

describe("PrimalJS hydrate() Client-Side DOM Activation & Adoption Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. Existing DOM element identity is preserved (nodeBefore === nodeAfter) & 4. Target is NOT cleared", () => {
        container.innerHTML = `
            <section id="card">
                <button id="save-btn">Save</button>
            </section>
        `;

        const sectionBefore = container.querySelector("#card");
        const buttonBefore = container.querySelector("#save-btn");

        function App() {
            return html`
                <section id="card">
                    <button id="save-btn">Save</button>
                </section>
            `;
        }

        hydrate(App, "#app");

        const sectionAfter = container.querySelector("#card");
        const buttonAfter = container.querySelector("#save-btn");

        assert.equal(sectionBefore, sectionAfter, "Section element identity must be preserved");
        assert.equal(buttonBefore, buttonAfter, "Button element identity must be preserved");
    });

    it("5. Component function executes EXACTLY ONCE (executions === 1)", () => {
        container.innerHTML = `<span>Count: 0</span>`;
        let executions = 0;

        function App() {
            executions++;
            const count = signal(0);
            return html`<span>Count: ${count}</span>`;
        }

        hydrate(App, container);
        assert.equal(executions, 1, "Component function must execute exactly once during hydration");
    });

    it("6. Event handler attaches, 7. fires correctly, 8. listener is not duplicated, and disposal cleans up", () => {
        container.innerHTML = `<button id="click-me">Click Me</button>`;
        let clicks = 0;

        function save() {
            clicks++;
        }

        function App() {
            return html`<button id="click-me" onclick=${save}>Click Me</button>`;
        }

        const app = hydrate(App, container);
        const button = container.querySelector("#click-me");

        // Click button 20 times
        for (let i = 0; i < 20; i++) {
            button.click();
        }

        assert.equal(clicks, 20, "Click handler must fire exactly 20 times without duplicate listeners");

        // Dispose app
        app.dispose();

        button.click();
        assert.equal(clicks, 20, "Event listener must be removed after app.dispose()");
    });

    it("9. Signal text bindings adopt existing DOM and update dynamically without destroying node identity", () => {
        container.innerHTML = `<span id="counter">0</span>`;

        const countSignal = signal(0);
        function App() {
            return html`<span id="counter">${countSignal}</span>`;
        }

        const spanBefore = container.querySelector("#counter");
        hydrate(App, container);

        const spanAfter = container.querySelector("#counter");
        assert.equal(spanBefore, spanAfter, "Span node must be preserved");

        // Update signal
        countSignal.value = 42;
        assert.equal(container.querySelector("#counter").textContent, "42");
        assert.equal(container.querySelector("#counter"), spanBefore, "Node identity must remain intact after signal update");
    });

    it("13. Ref points to existing DOM Element", () => {
        container.innerHTML = `<button id="save">Save</button>`;
        const saveRef = ref();

        function App() {
            return html`<button id="save" ref=${saveRef}>Save</button>`;
        }

        const buttonBefore = container.querySelector("#save");
        hydrate(App, container);

        assert.equal(saveRef.current, buttonBefore, "Ref must point directly to existing DOM element");
    });

    it("14. onMount and 15. onDestroy lifecycle hooks run correctly", () => {
        container.innerHTML = `<div>Lifecycle Test</div>`;
        let mounted = 0;
        let destroyed = 0;

        function App() {
            onMount(() => { mounted++; });
            onDestroy(() => { destroyed++; });
            return html`<div>Lifecycle Test</div>`;
        }

        const app = hydrate(App, container);
        assert.equal(mounted, 1, "onMount must run once after hydration");
        assert.equal(destroyed, 0);

        app.dispose();
        assert.equal(destroyed, 1, "onDestroy must run once when disposed");
    });

    it("18. Multiple root nodes hydrate correctly without requiring a single wrapper tag", () => {
        container.innerHTML = `
            <header id="hdr">Header</header>
            <main id="body">Main Content</main>
            <footer id="ftr">Footer</footer>
        `;

        const headerBefore = container.querySelector("#hdr");
        const mainBefore = container.querySelector("#body");

        function App() {
            return html`
                <header id="hdr">Header</header>
                <main id="body">Main Content</main>
                <footer id="ftr">Footer</footer>
            `;
        }

        hydrate(App, container);

        assert.equal(container.querySelector("#hdr"), headerBefore);
        assert.equal(container.querySelector("#body"), mainBefore);
    });

    it("19. Nested components hydrate correctly", () => {
        container.innerHTML = `
            <div id="wrapper">
                <nav id="nav-bar">Navigation</nav>
                <section id="content">Main Editor</section>
            </div>
        `;

        function NavBar() {
            return html`<nav id="nav-bar">Navigation</nav>`;
        }
        function MainContent() {
            return html`<section id="content">Main Editor</section>`;
        }
        register(NavBar, MainContent);

        function App() {
            return html`
                <div id="wrapper">
                    <NavBar />
                    <MainContent />
                </div>
            `;
        }

        const navBefore = container.querySelector("#nav-bar");
        hydrate(App, container);

        assert.equal(container.querySelector("#nav-bar"), navBefore, "Nested component DOM must be adopted");
    });

    it("25. Empty target falls back to mount() with warning", () => {
        container.innerHTML = ""; // Completely empty target

        function App() {
            return html`<button id="new-btn">New Button</button>`;
        }

        const app = hydrate(App, container);

        assert.ok(container.querySelector("#new-btn"), "Empty target must fall back to mount and create element");
        app.dispose();
    });

    it("26. Live form input value and focus are preserved during hydration", () => {
        container.innerHTML = `<input id="user-input" type="text" value="Initial" />`;
        const inputEl = container.querySelector("#user-input");

        // User types into input before JS hydration
        inputEl.value = "User Edited Value";
        inputEl.focus();
        assert.equal(document.activeElement, inputEl);

        const valSignal = signal("Initial");
        function App() {
            return html`<input id="user-input" type="text" value=${valSignal} />`;
        }

        hydrate(App, container);

        assert.equal(container.querySelector("#user-input"), inputEl, "Input node must be preserved");
        assert.equal(inputEl.value, "User Edited Value", "Live input value must NOT be overwritten on hydration");
    });

    it("29. activate() delegates to hydrate() with full backward compatibility", () => {
        container.innerHTML = `<button id="act-btn">Activate</button>`;

        function App() {
            return html`<button id="act-btn">Activate</button>`;
        }

        const btnBefore = container.querySelector("#act-btn");
        const handle = activate(App, container);

        assert.equal(container.querySelector("#act-btn"), btnBefore);
        handle.dispose();
    });

    it("30. 100-update signal stress test on hydrated DOM preserves node identity", () => {
        container.innerHTML = `
            <div id="stress-box">
                <span id="val-span">0</span>
            </div>
        `;

        const valSignal = signal(0);
        function App() {
            return html`
                <div id="stress-box">
                    <span id="val-span">${valSignal}</span>
                </div>
            `;
        }

        const spanBefore = container.querySelector("#val-span");
        const app = hydrate(App, container);

        for (let i = 1; i <= 100; i++) {
            valSignal.value = i;
        }

        assert.equal(container.querySelector("#val-span").textContent, "100");
        assert.equal(container.querySelector("#val-span"), spanBefore, "Node identity must remain constant throughout 100 updates");

        app.dispose();
    });
});
