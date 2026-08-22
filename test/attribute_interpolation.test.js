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

    it("4. supports 2 interpolations in single class attribute class=\"btn ${size} ${active ? 'active' : ''}\"", () => {
        const size = signal("btn-lg");
        const active = signal(false);

        function MultiClassBtn() {
            return html`<button class="btn ${size} ${() => active.value ? "active" : ""}">Save</button>`;
        }

        mount(MultiClassBtn, container);
        const btn = container.querySelector("button");

        assert.equal(btn.className, "btn btn-lg ");

        active.value = true;
        assert.equal(btn.className, "btn btn-lg active");

        size.value = "btn-sm";
        assert.equal(btn.className, "btn btn-sm active");
    });

    it("5. supports 3 interpolations in href attribute href=\"/users/${userId}/posts/${postId}?ref=${ref}\"", () => {
        const userId = signal(42);
        const postId = signal(108);
        const refParam = signal("email");

        function DynamicLink() {
            return html`<a href="/users/${userId}/posts/${postId}?ref=${refParam}">Post Link</a>`;
        }

        mount(DynamicLink, container);
        const link = container.querySelector("a");

        assert.equal(link.getAttribute("href"), "/users/42/posts/108?ref=email");

        postId.value = 200;
        assert.equal(link.getAttribute("href"), "/users/42/posts/200?ref=email");

        refParam.value = "social";
        assert.equal(link.getAttribute("href"), "/users/42/posts/200?ref=social");
    });

    it("6. supports 4 interpolations across style, aria-*, and data-* attributes", () => {
        const color = signal("red");
        const size = signal(16);
        const role = signal("admin");
        const id = signal("user-1");

        function Widget() {
            return html`<div
                style="color: ${color}; font-size: ${size}px"
                aria-label="User ${id} (${role})"
                data-info="id:${id},type:${role},color:${color}"
            >Widget</div>`;
        }

        mount(Widget, container);
        const div = container.querySelector("div");

        assert.equal(div.getAttribute("style"), "color: red; font-size: 16px");
        assert.equal(div.getAttribute("aria-label"), "User user-1 (admin)");
        assert.equal(div.getAttribute("data-info"), "id:user-1,type:admin,color:red");

        color.value = "blue";
        size.value = 24;
        role.value = "guest";

        assert.equal(div.getAttribute("style"), "color: blue; font-size: 24px");
        assert.equal(div.getAttribute("aria-label"), "User user-1 (guest)");
        assert.equal(div.getAttribute("data-info"), "id:user-1,type:guest,color:blue");
    });
});
