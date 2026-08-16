import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, onMount, onDestroy, mount, unmount } from "../primal.js";

describe("PrimalJS Lifecycle & Memory Management Cleanup", () => {
    it("executes onMount and onDestroy lifecycle hooks correctly", () => {
        let mounted = false;
        let destroyed = false;

        function TestComp() {
            onMount(() => {
                mounted = true;
            });
            onDestroy(() => {
                destroyed = true;
            });

            return html`<div>Lifecycle Test</div>`;
        }

        const appEl = document.getElementById("app");
        assert.equal(mounted, false);
        assert.equal(destroyed, false);

        mount(TestComp, appEl);
        assert.equal(mounted, true, "onMount hook must execute upon mounting");
        assert.equal(destroyed, false);

        unmount(appEl);
        assert.equal(destroyed, true, "onDestroy hook must execute upon unmounting");
    });

    it("unsubscribes signal effects when component unmounts", () => {
        let effectRunCount = 0;
        const count = signal(0);

        function StatefulComp() {
            onMount(() => {
                // Reactive binding creates internal effect
            });

            return html`<span>Count: ${count}</span>`;
        }

        const appEl = document.getElementById("app");
        mount(StatefulComp, appEl);
        assert.equal(appEl.textContent.trim(), "Count: 0");

        count.value = 1;
        assert.equal(appEl.textContent.trim(), "Count: 1");

        // Unmount component
        unmount(appEl);

        // Updating count after unmount should NOT error and should be clean
        count.value = 2;
        assert.equal(appEl.textContent.trim(), "");
    });
});
