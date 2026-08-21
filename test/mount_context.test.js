import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, onDestroy, onMount, register, Load } from "../src/index.js";

describe("PrimalJS <Load> Context Disposal & Parenting", () => {
    it("disposes previous component context and fires onDestroy when switching components", () => {
        let comp1Destroyed = false;
        let comp2Mounted = false;

        function Comp1() {
            onDestroy(() => {
                comp1Destroyed = true;
            });
            return html`<div class="comp1">Component 1</div>`;
        }

        function Comp2() {
            onMount(() => {
                comp2Mounted = true;
            });
            return html`<div class="comp2">Component 2</div>`;
        }

        register(Comp1, Comp2, Load);

        const activeComp = signal(Comp1);

        function App() {
            return html`<Load component=${activeComp} />`;
        }

        const handle = mount(App, "#app");

        assert.equal(document.querySelector(".comp1").textContent, "Component 1");
        assert.equal(comp1Destroyed, false);

        // Switch to Comp2
        activeComp.value = Comp2;

        assert.equal(document.querySelector(".comp1"), null);
        assert.equal(document.querySelector(".comp2").textContent, "Component 2");
        assert.equal(comp1Destroyed, true);
        assert.equal(comp2Mounted, true);

        handle.dispose();
    });

    it("disposes active component context and unlinks children when parent app is disposed", () => {
        let compDestroyed = false;

        function ChildComp() {
            onDestroy(() => {
                compDestroyed = true;
            });
            return html`<div class="child">Child Content</div>`;
        }

        register(ChildComp, Load);

        function App() {
            return html`<Load component=${ChildComp} />`;
        }

        const handle = mount(App, "#app");

        assert.equal(document.querySelector(".child").textContent, "Child Content");
        assert.equal(compDestroyed, false);

        // Dispose parent application
        handle.dispose();

        assert.equal(document.querySelector(".child"), null);
        assert.equal(compDestroyed, true);
    });
});
