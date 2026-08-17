import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, onDestroy, onMount, register, Try, Catch } from "../src/index.js";
import { Render } from "../src/render.js";

describe("PrimalJS <Render> Context Disposal & Parenting", () => {
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

        register(Comp1, Comp2, Render);

        const activeComp = signal(Comp1);

        function App() {
            return html`<Render component=${activeComp} />`;
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

        register(ChildComp, Render);

        function App() {
            return html`<Render component=${ChildComp} />`;
        }

        const handle = mount(App, "#app");

        assert.equal(document.querySelector(".child").textContent, "Child Content");
        assert.equal(compDestroyed, false);

        // Dispose parent application
        handle.dispose();

        assert.equal(document.querySelector(".child"), null);
        assert.equal(compDestroyed, true);
    });

    it("inherits <Try> error boundary across reactive component switches", () => {
        let errorCaught = null;

        function NormalComp() {
            return html`<div class="normal">Normal Component</div>`;
        }

        function FaultyComp() {
            onMount(() => {
                throw new Error("Switched Component Mount Error");
            });
            return html`<div class="faulty">Faulty Component</div>`;
        }

        register(NormalComp, FaultyComp, Render, Try, Catch);

        const activeComp = signal(NormalComp);

        function App() {
            return html`
                <Try>
                    <Render component=${activeComp} />
                    <Catch>${(err) => { errorCaught = err; return html`<div class="error">Error: ${err.message}</div>`; }}</Catch>
                </Try>
            `;
        }

        const handle = mount(App, "#app");

        assert.equal(document.querySelector(".normal").textContent, "Normal Component");
        assert.equal(errorCaught, null);

        // Switch reactively to FaultyComp inside <Try>
        activeComp.value = FaultyComp;

        assert.ok(errorCaught);
        assert.equal(errorCaught.message, "Switched Component Mount Error");
        assert.equal(document.querySelector(".error").textContent, "Error: Switched Component Mount Error");

        handle.dispose();
    });
});
