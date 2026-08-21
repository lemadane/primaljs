import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, clearRegistry, register, Boundary } from "../src/index.js";

describe("PrimalJS <Boundary> Local Error Handling Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. catches sub-component reactive effect errors and renders fallback UI", () => {
        const broken = signal(false);

        function FaultyChild() {
            return html`
                ${() => {
                    if (broken.value) {
                        throw new Error("Subtree Error Inside Reactive Effect");
                    }
                    return html`<div class="child">Normal Subtree</div>`;
                }}
            `;
        }

        function App() {
            return html`
                <Boundary fallback=${(err) => html`<div class="fallback">Caught: ${err.message}</div>`}>
                    <FaultyChild />
                </Boundary>
            `;
        }

        register(FaultyChild, App);
        mount(App, container);
        assert.equal(container.querySelector(".child").textContent, "Normal Subtree");

        // Trigger error reactively inside subtree
        broken.value = true;
        assert.equal(container.querySelector(".fallback").textContent, "Caught: Subtree Error Inside Reactive Effect");
    });
});
