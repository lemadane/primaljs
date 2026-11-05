import "../../test/setup.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mount } from "../../src/index.js";
import { TodoEditor } from "./TodoEditor.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function submit(title) {
    const form = document.querySelector("form");
    form.elements.namedItem("title").value = title;
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    return form;
}

test("injected save is called once while pending and resets input on success", async () => {
    let resolveSave;
    const calls = [];
    const handle = mount(() => TodoEditor({ onSave: title => {
        calls.push(title);
        return new Promise(resolve => { resolveSave = resolve; });
    } }), "#app");
    try {
        const form = submit("Ship it");
        submit("Duplicate");
        assert.deepEqual(calls, ["Ship it"]);
        assert.equal(document.querySelector("button").disabled, true);
        resolveSave();
        await tick();
        assert.equal(form.elements.namedItem("title").value, "");
        assert.equal(document.querySelector('[role="status"]').textContent, "Saved.");
        assert.equal(document.querySelector("button").disabled, false);
    } finally { handle.dispose(); }
});

test("a replacement save callback can fail and be retried without losing input", async () => {
    let fail = true;
    const handle = mount(() => TodoEditor({ onSave: async () => {
        if (fail) throw new Error("Offline");
    } }), "#app");
    try {
        const form = submit("Keep this");
        await tick();
        assert.equal(document.querySelector('[role="alert"]').textContent, "Offline");
        assert.equal(form.elements.namedItem("title").value, "Keep this");
        assert.equal(document.querySelector("button").disabled, false);
        fail = false;
        submit("Keep this");
        await tick();
        assert.equal(document.querySelector('[role="alert"]').textContent, "");
        assert.equal(form.elements.namedItem("title").value, "");
    } finally { handle.dispose(); }
});

test("late completion after disposal does not reset the detached form", async () => {
    let resolveSave;
    const handle = mount(() => TodoEditor({ onSave: () => new Promise(resolve => { resolveSave = resolve; }) }), "#app");
    const form = submit("Preserve");
    handle.dispose();
    resolveSave();
    await tick();
    assert.equal(form.elements.namedItem("title").value, "Preserve");
    assert.equal(document.querySelector("form"), null);
});
