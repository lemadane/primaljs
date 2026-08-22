import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, clearRegistry, register, Guard, Boundary, onMount } from "../src/index.js";

describe("PrimalJS <Guard> Local Error Handling Suite", () => {
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
                <Guard fallback=${(err) => html`<div class="fallback">Caught: ${err.message}</div>`}>
                    <FaultyChild />
                </Guard>
            `;
        }

        register(FaultyChild, App);
        mount(App, container);
        assert.equal(container.querySelector(".child").textContent, "Normal Subtree");

        // Trigger error reactively inside subtree
        broken.value = true;
        assert.equal(container.querySelector(".fallback").textContent, "Caught: Subtree Error Inside Reactive Effect");
    });

    it("2. catches initial-render child component exception and renders fallback UI", () => {
        function ThrowingChild() {
            throw new Error("Constructor Render Failure");
        }

        function App() {
            return html`
                <Boundary fallback=${(err) => html`<div class="fallback-initial">Error: ${err.message}</div>`}>
                    <ThrowingChild />
                </Boundary>
            `;
        }

        register(ThrowingChild, App);
        mount(App, container);
        assert.equal(container.querySelector(".fallback-initial").textContent, "Error: Constructor Render Failure");
    });

    it("3. supports retry() fallback callback restoring normal subtree when error condition is resolved", () => {
        const shouldFail = signal(true);

        function FlakyChild() {
            return html`
                ${() => {
                    if (shouldFail.value) {
                        throw new Error("Temporary Failure");
                    }
                    return html`<div class="recovered">Recovered Content</div>`;
                }}
            `;
        }

        function App() {
            return html`
                <Boundary fallback=${(err, retry) => html`
                    <div class="fallback-retry">
                        <span>Failed: ${err.message}</span>
                        <button class="retry-btn" onclick=${retry}>Retry</button>
                    </div>
                `}>
                    <FlakyChild />
                </Boundary>
            `;
        }

        register(FlakyChild, App);
        mount(App, container);
        assert.equal(container.querySelector(".fallback-retry span").textContent, "Failed: Temporary Failure");

        // Fix underlying error condition and click retry
        shouldFail.value = false;
        const btn = container.querySelector(".retry-btn");
        btn.click();

        assert.equal(container.querySelector(".recovered").textContent, "Recovered Content");
    });

    it("4. isolates errors to inner boundary without triggering outer boundary", () => {
        const innerBroken = signal(false);

        function InnerComponent() {
            return html`
                ${() => {
                    if (innerBroken.value) {
                        throw new Error("Inner Subtree Failure");
                    }
                    return html`<div class="inner-ok">Inner OK</div>`;
                }}
            `;
        }

        function App() {
            return html`
                <Boundary fallback=${() => html`<div class="outer-fallback">Outer Fallback</div>`}>
                    <div class="outer-wrapper">
                        <span>Outer Content</span>
                        <Boundary fallback=${(err) => html`<div class="inner-fallback">Inner: ${err.message}</div>`}>
                            <InnerComponent />
                        </Boundary>
                    </div>
                </Boundary>
            `;
        }

        register(InnerComponent, App);
        mount(App, container);
        assert.equal(container.querySelector(".inner-ok").textContent, "Inner OK");
        assert.equal(container.querySelector(".outer-wrapper span").textContent, "Outer Content");

        innerBroken.value = true;

        assert.equal(container.querySelector(".inner-fallback").textContent, "Inner: Inner Subtree Failure");
        assert.equal(container.querySelector(".outer-wrapper span").textContent, "Outer Content");
        assert.equal(container.querySelector(".outer-fallback"), null, "Outer boundary must not catch isolated inner error");
    });

    it("5. catches onMount lifecycle hook errors and renders fallback UI", () => {
        function MountingFaultyChild() {
            onMount(() => {
                throw new Error("onMount Lifecycle Failure");
            });
            return html`<div class="mount-child">Mount Child</div>`;
        }

        function App() {
            return html`
                <Boundary fallback=${(err) => html`<div class="mount-fallback">Mount Error: ${err.message}</div>`}>
                    <MountingFaultyChild />
                </Boundary>
            `;
        }

        register(MountingFaultyChild, App);
        mount(App, container);
        assert.equal(container.querySelector(".mount-fallback").textContent, "Mount Error: onMount Lifecycle Failure");
    });
});
