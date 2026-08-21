import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, mount, clearRegistry } from "../src/index.js";

describe("PrimalJS Mixed Attribute & Reactive Attribute Interpolation Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
    });

    it("1. renders mixed attribute string with static prefix and reactive ternary expression", () => {
        const isDone = signal(false);

        function Item() {
            return html`<li class="todo-item ${() => isDone.value ? "completed" : ""}">Task Item</li>`;
        }

        mount(Item, container);
        const li = container.querySelector("li");

        assert.equal(li.className, "todo-item ");

        isDone.value = true;
        assert.equal(li.className, "todo-item completed");

        isDone.value = false;
        assert.equal(li.className, "todo-item ");
    });

    it("2. supports static function evaluation in class attribute class=${() => active.value ? 'button active' : 'button'}", () => {
        const active = signal(false);

        function Btn() {
            return html`<button class=${() => active.value ? "button active" : "button"}>Click Me</button>`;
        }

        mount(Btn, container);
        const btn = container.querySelector("button");

        assert.equal(btn.className, "button");

        active.value = true;
        assert.equal(btn.className, "button active");
    });

    it("3. handles mixed prefix-suffix interpolation class=\"prefix-${val}-suffix\"", () => {
        const theme = signal("dark");

        function Card() {
            return html`<div class="card theme-${theme}-mode">Card Content</div>`;
        }

        mount(Card, container);
        const div = container.querySelector("div");

        assert.equal(div.className, "card theme-dark-mode");

        theme.value = "light";
        assert.equal(div.className, "card theme-light-mode");
    });
});
