import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, unmount } from "../primal.js";

describe("Mandatory Component Execution Test (Requirement #13)", () => {
    it("proves Signal changes do NOT re-execute component function", () => {
        let executions = 0;
        let count;

        function Counter() {
            executions++;
            count = signal(0);

            return html`
                <span>${count}</span>
            `;
        }

        const appEl = document.getElementById("app");
        mount(Counter, appEl);

        assert.equal(executions, 1, "Component function must execute exactly once on mount");

        // Mutate Signal multiple times
        count.value++;
        count.value++;
        count.value++;

        assert.equal(
            executions,
            1,
            "Component function must NOT re-execute when Signal values update"
        );
        assert.equal(appEl.textContent.trim(), "3");

        unmount(appEl);
    });
});
