import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, clearRegistry } from "../src/index.js";

describe("PrimalJS Keyed List DOM Reconciliation & Identity Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. preserves existing DOM nodes and input focus when array re-evaluates", () => {
        const todos = signal([
            { id: 1, text: "First Item" },
            { id: 2, text: "Second Item" }
        ]);

        function ListApp() {
            return html`
                <ul class="todo-list">
                    ${() => todos.value.map(item => html`
                        <li class="item" key=${item.id} data-id=${item.id}>
                            <input type="text" value=${item.text} class="input-${item.id}" />
                        </li>
                    `)}
                </ul>
            `;
        }

        mount(ListApp, container);

        const input1 = container.querySelector(".input-1");
        const input2 = container.querySelector(".input-2");
        assert.ok(input1, "Input 1 should exist");
        input1.focus();

        // Mutate list by adding a 3rd item
        todos.value = [
            { id: 1, text: "First Item" },
            { id: 2, text: "Second Item" },
            { id: 3, text: "Third Item" }
        ];

        const updatedInput1 = container.querySelector(".input-1");
        const updatedInput2 = container.querySelector(".input-2");
        const updatedInput3 = container.querySelector(".input-3");

        // Assert DOM nodes were preserved by reference identity
        assert.ok(updatedInput1 === input1, "Input 1 reference identity preserved");
        assert.ok(updatedInput2 === input2, "Input 2 reference identity preserved");
        assert.ok(updatedInput3, "Input 3 added");
        assert.equal(container.querySelectorAll("li").length, 3);
    });

    it("2. reorders DOM nodes in-place when list order changes", () => {
        const items = signal([
            { id: 10, title: "A" },
            { id: 20, title: "B" }
        ]);

        function App() {
            return html`
                <div>
                    ${() => items.value.map(it => html`<span key=${it.id} data-id=${it.id}>${it.title}</span>`)}
                </div>
            `;
        }

        mount(App, container);

        const firstSpanA = container.querySelector("[data-id='10']");

        // Reverse list
        items.value = [
            { id: 20, title: "B" },
            { id: 10, title: "A" }
        ];

        const spans = container.querySelectorAll("span");
        assert.equal(spans[0].getAttribute("data-id"), "20");
        assert.equal(spans[1].getAttribute("data-id"), "10");
        assert.ok(spans[1] === firstSpanA, "Span A reference identity preserved after reorder");
    });
});
