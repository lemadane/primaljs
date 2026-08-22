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
});
