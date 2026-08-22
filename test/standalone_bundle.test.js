import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("PrimalJS Standalone ES Module Bundle (Zero Build) Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("imports dist/primal.standalone.js as a zero-dependency ES module and mounts app", async () => {
        const PrimalStandalone = await import("../dist/primal.standalone.js");

        assert.ok(PrimalStandalone.signal, "Exports signal()");
        assert.ok(PrimalStandalone.html, "Exports html()");
        assert.ok(PrimalStandalone.mount, "Exports mount()");
        assert.ok(PrimalStandalone.Boundary, "Exports Boundary");
        assert.ok(PrimalStandalone.createApp, "Exports createApp()");

        const count = PrimalStandalone.signal(5);

        function StandaloneApp() {
            return PrimalStandalone.html`<button class="btn">Val: ${count}</button>`;
        }

        const handle = PrimalStandalone.mount(StandaloneApp, container);

        const btn = container.querySelector("button");
        assert.ok(btn, "Mounts button element");
        assert.equal(btn.textContent, "Val: 5");

        count.value = 10;
        assert.equal(btn.textContent, "Val: 10");

        handle.dispose();
    });

    it("imports dist/primal.min.js as a zero-dependency minified ES module and mounts app", async () => {
        const PrimalMin = await import("../dist/primal.min.js");

        assert.ok(PrimalMin.signal, "Exports signal()");
        assert.ok(PrimalMin.html, "Exports html()");
        assert.ok(PrimalMin.mount, "Exports mount()");
        assert.ok(PrimalMin.createApp, "Exports createApp()");

        const count = PrimalMin.signal(42);

        function MinApp() {
            return PrimalMin.html`<div id="min-app">Minified Val: ${count}</div>`;
        }

        const handle = PrimalMin.mount(MinApp, container);

        const el = container.querySelector("#min-app");
        assert.ok(el, "Mounts element from minified module");
        assert.equal(el.textContent, "Minified Val: 42");

        count.value = 100;
        assert.equal(el.textContent, "Minified Val: 100");

        handle.dispose();
    });
});
