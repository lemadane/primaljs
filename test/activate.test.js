import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { html, signal, activate, unmount } from "../src/index.js";

describe("PrimalJS DOM Activation Engine (activate)", () => {
    let dom;
    let document;
    let window;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="app"></div></body></html>`, {
            url: "http://localhost/"
        });
        document = dom.window.document;
        window = dom.window;
        globalThis.document = document;
        globalThis.window = window;
        globalThis.Node = window.Node;
        globalThis.Element = window.Element;
        globalThis.HTMLElement = window.HTMLElement;
        globalThis.Text = window.Text;
        globalThis.Comment = window.Comment;
        globalThis.DocumentFragment = window.DocumentFragment;
    });

    afterEach(() => {
        delete globalThis.document;
        delete globalThis.window;
        delete globalThis.Node;
        delete globalThis.Element;
        delete globalThis.HTMLElement;
        delete globalThis.Text;
        delete globalThis.Comment;
        delete globalThis.DocumentFragment;
    });

    it("activates existing DOM, binds Signals & event listeners, and preserves element identity", () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = `
            <div class="card">
                <h2>Hello Lemuel</h2>
                <button class="btn">Count: 0</button>
            </div>
        `;

        const buttonBefore = appEl.querySelector("button");

        let clicked = false;
        const count = signal(0);

        function Counter() {
            function increment() {
                clicked = true;
                count.value++;
            }

            return html`
                <div class="card">
                    <h2>Hello Lemuel</h2>
                    <button class="btn" onclick=${increment}>Count: ${count}</button>
                </div>
            `;
        }

        const handle = activate(Counter, "#app");

        const buttonAfter = appEl.querySelector("button");
        assert.equal(buttonBefore, buttonAfter, "Pre-rendered DOM button element identity must be preserved");

        // Click button attached via activate()
        buttonAfter.click();
        assert.equal(clicked, true, "Event listener attached by activate() must execute on click");
        assert.equal(count.value, 1);
        assert.equal(buttonAfter.textContent.trim(), "Count: 1", "Signal mutation must update pre-rendered DOM node");

        count.value = 42;
        assert.equal(buttonAfter.textContent.trim(), "Count: 42", "Subsequent Signal mutation updates activated DOM");

        handle.dispose();
    });

    it("hydrates initial state from #primal-state script tag into App component props", () => {
        const appEl = document.getElementById("app");
        appEl.innerHTML = `
            <script id="primal-state" type="application/json">{"user": "Lemuel", "initialCount": 10}</script>
            <div class="card">
                <h2 data-primal-bind="user">Lemuel</h2>
                <button class="btn">Count: 10</button>
            </div>
        `;

        let receivedProps = null;
        function HydratedApp(props) {
            receivedProps = props;
            const count = signal(props.initialCount || 0);

            return html`
                <div class="card">
                    <h2 data-primal-bind="user">${props.user}</h2>
                    <button class="btn" onclick=${() => count.value++}>Count: ${count}</button>
                </div>
            `;
        }

        const handle = activate(HydratedApp, "#app");

        assert.equal(receivedProps.user, "Lemuel");
        assert.equal(receivedProps.initialCount, 10);

        const btn = appEl.querySelector("button");
        btn.click();
        assert.equal(btn.textContent.trim(), "Count: 11");

        handle.dispose();
    });
});
