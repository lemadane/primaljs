import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, unmount } from "../primal.js";

describe("Mandatory DOM Identity Test (Requirement #12)", () => {
    it("proves unrelated DOM nodes remain identical when Signals update", () => {
        let count;

        function Counter() {
            count = signal(0);

            return html`
                <section>
                    <h1 id="heading">Counter</h1>
                    <span id="value">${count}</span>
                </section>
            `;
        }

        const appEl = document.getElementById("app");
        mount(Counter, appEl);

        const headingBefore = document.querySelector("#heading");
        const spanValueBefore = document.querySelector("#value");
        assert.ok(headingBefore, "Heading element must exist before update");
        assert.equal(spanValueBefore.textContent, "0");

        // Mutate signal value
        count.value++;

        const headingAfter = document.querySelector("#heading");
        const spanValueAfter = document.querySelector("#value");

        assert.equal(spanValueAfter.textContent, "1");
        // Strict DOM Identity Assertion
        assert.strictEqual(
            headingBefore,
            headingAfter,
            "Heading DOM element reference must remain strictly identical after Signal update"
        );

        unmount(appEl);
    });
});
