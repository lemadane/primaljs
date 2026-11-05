import "../../test/setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mount } from "../../src/index.js";
import { TodoPage } from "./ui/TodoPage.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const submit = form => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

test("loading and saving disable input; repeated submissions save once", async () => {
    let resolveList;
    let resolveSave;
    let saves = 0;
    const handle = mount(() => TodoPage({ todos: {
        list: () => new Promise(resolve => { resolveList = resolve; }),
        add: () => { saves++; return new Promise(resolve => { resolveSave = resolve; }); }
    } }), "#app");
    try {
        const form = document.querySelector("form");
        const input = form.elements.namedItem("title");
        assert.equal(input.disabled, true);
        resolveList([]);
        await tick();
        assert.equal(input.disabled, false);
        input.value = "First";
        submit(form);
        submit(form);
        assert.equal(saves, 1);
        assert.equal(input.disabled, true);
        resolveSave({ id: "1", title: "First", completed: false });
        await tick();
        assert.equal(input.value, "");
        assert.equal(input.disabled, false);
        assert.equal(document.querySelector("li").textContent, "First");
    } finally { handle.dispose(); }
});

for (const reject of [false, true]) {
    test(`late save ${reject ? "failure" : "success"} after disposal leaves form untouched`, async () => {
        let settle;
        const handle = mount(() => TodoPage({ todos: {
            list: async () => [],
            add: () => new Promise((resolve, fail) => { settle = reject ? fail : resolve; })
        } }), "#app");
        await tick();
        const form = document.querySelector("form");
        const input = form.elements.namedItem("title");
        input.value = "Preserve";
        submit(form);
        handle.dispose();
        settle(reject ? new Error("Offline") : { id: "1", title: "Preserve", completed: false });
        await tick();
        assert.equal(input.value, "Preserve");
        assert.equal(document.querySelector("form"), null);
    });
}

test("save failure preserves input and allows retry", async () => {
    const handle = mount(() => TodoPage({ todos: {
        list: async () => [],
        add: async () => { throw new Error("Offline"); }
    } }), "#app");
    try {
        await tick();
        const form = document.querySelector("form");
        const input = form.elements.namedItem("title");
        input.value = "Retry me";
        submit(form);
        await tick();
        assert.equal(input.value, "Retry me");
        assert.equal(input.disabled, false);
        assert.equal(document.querySelector('[role="alert"]').textContent, "Offline");
    } finally { handle.dispose(); }
});
