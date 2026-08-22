import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal } from "../src/signal.js";
import { html } from "../src/html.js";
import { mount } from "../src/load.js";
import { ref } from "../src/ref.js";
import { onMount, onDestroy } from "../src/lifecycle.js";

describe("PrimalJS Root Application Disposal", () => {
    it("mount() returns a handle with dispose() that cleans up DOM and reactivity", () => {
        const count = signal(0);
        let mounted = false;
        let destroyed = false;
        const myRef = ref();

        function App() {
            onMount(() => { mounted = true; });
            onDestroy(() => { destroyed = true; });

            return html`
                <div>
                    <button ref=${myRef} id="btn">Count: ${count}</button>
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        assert.equal(mounted, true);
        assert.equal(document.querySelector("#btn").textContent, "Count: 0");
        assert.equal(myRef.current.tagName.toLowerCase(), "button");

        // Dispose app
        app.dispose();

        assert.equal(destroyed, true);
        assert.equal(appEl.innerHTML, "");
        assert.equal(myRef.current, null);

        // Updating count signal after disposal MUST NOT alter DOM
        count.value++;
        assert.equal(appEl.innerHTML, "");
    });

    it("app.dispose() is idempotent", () => {
        function App() {
            return html`<p>Hello</p>`;
        }
        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        assert.doesNotThrow(() => {
            app.dispose();
            app.dispose();
            app.dispose();
        });
        assert.equal(appEl.innerHTML, "");
    });

    it("supports dispose and re-mount cleanly", () => {
        const value = signal("First");
        function App() {
            return html`<h1 id="title">${value}</h1>`;
        }

        const appEl = document.getElementById("app");
        let app = mount(App, appEl);

        assert.equal(document.querySelector("#title").textContent, "First");

        app.dispose();
        assert.equal(appEl.innerHTML, "");

        value.value = "Second";

        // Re-mount
        app = mount(App, appEl);
        assert.equal(document.querySelector("#title").textContent, "Second");

        value.value = "Third";
        assert.equal(document.querySelector("#title").textContent, "Third");

        app.dispose();
    });
});
