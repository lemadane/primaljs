import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { signal, computed, effect } from "../src/signal.js";

describe("PrimalJS Signal System", () => {
    it("reads and writes basic signal values", () => {
        const count = signal(0);
        assert.equal(count.value, 0);

        count.value = 5;
        assert.equal(count.value, 5);

        count.value++;
        assert.equal(count.value, 6);
    });

    it("automatically tracks dependencies in computed signals", () => {
        const firstName = signal("John");
        const lastName = signal("Smith");
        const fullName = computed(() => `${firstName.value} ${lastName.value}`);

        assert.equal(fullName.value, "John Smith");

        firstName.value = "Jane";
        assert.equal(fullName.value, "Jane Smith");

        lastName.value = "Doe";
        assert.equal(fullName.value, "Jane Doe");
    });

    it("runs effects on dependency change and disposes correctly", () => {
        const count = signal(1);
        let runCount = 0;
        let lastSeen = null;

        const dispose = effect(() => {
            runCount++;
            lastSeen = count.value;
        });

        assert.equal(runCount, 1);
        assert.equal(lastSeen, 1);

        count.value = 10;
        assert.equal(runCount, 2);
        assert.equal(lastSeen, 10);

        dispose();
        count.value = 20;
        assert.equal(runCount, 2); // Should not run after dispose
        assert.equal(lastSeen, 10);
    });
});
