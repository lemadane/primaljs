import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal, computed, effect, batch, untrack } from "../src/signal.js";

describe("PrimalJS Reactivity Enhancements (batch & untrack)", () => {
    it("batch() deduplicates subscriber executions for multiple signal writes", () => {
        const firstName = signal("John");
        const lastName = signal("Doe");
        const fullName = computed(() => `${firstName.value} ${lastName.value}`);

        let executions = 0;
        let lastValue = "";

        effect(() => {
            executions++;
            lastValue = fullName.value;
        });

        assert.equal(executions, 1);
        assert.equal(lastValue, "John Doe");

        batch(() => {
            firstName.value = "Lemuel";
            lastName.value = "Adane";
        });

        assert.equal(executions, 2);
        assert.equal(lastValue, "Lemuel Adane");
    });

    it("nested batch() flushes only when outermost batch finishes", () => {
        const a = signal(1);
        const b = signal(2);
        const c = signal(3);

        let executions = 0;
        effect(() => {
            executions++;
            a.value + b.value + c.value;
        });

        assert.equal(executions, 1);

        batch(() => {
            a.value = 10;
            batch(() => {
                b.value = 20;
                c.value = 30;
            });
            assert.equal(executions, 1);
        });

        assert.equal(executions, 2);
    });

    it("batch() restores batchDepth and propagates errors on callback exception", () => {
        const count = signal(0);
        let executions = 0;

        effect(() => {
            executions++;
            count.value;
        });

        assert.throws(() => {
            batch(() => {
                count.value++;
                throw new Error("Batch Error");
            });
        }, /Batch Error/);

        // Signal write was applied
        assert.equal(count.value, 1);
        // Next signal write updates effects normally
        count.value++;
        assert.equal(count.value, 2);
    });

    it("untrack() evaluates callback without creating reactive dependency", () => {
        const tracked = signal(1);
        const ignored = signal(10);

        let executions = 0;
        let lastIgnored = 0;

        effect(() => {
            executions++;
            tracked.value;
            lastIgnored = untrack(() => ignored.value);
        });

        assert.equal(executions, 1);
        assert.equal(lastIgnored, 10);

        // Updating tracked signal triggers effect
        tracked.value++;
        assert.equal(executions, 2);

        // Updating ignored signal inside untrack does NOT trigger effect
        ignored.value = 99;
        assert.equal(executions, 2);
        assert.equal(ignored.value, 99);
    });

    it("untrack() returns callback result directly and supports nested untrack()", () => {
        const s1 = signal("a");
        const s2 = signal("b");

        const res = untrack(() => {
            const val1 = s1.value;
            const val2 = untrack(() => s2.value);
            return `${val1}-${val2}`;
        });

        assert.equal(res, "a-b");
    });
});

it("batch invalidates computed chains immediately and deduplicates mixed dependencies", () => {
    const source = signal(1);
    const doubled = computed(() => source.value * 2);
    const derived = computed(() => doubled.value + 1);
    const seen = [];
    const stop = effect(() => seen.push([source.value, derived.value]));
    batch(() => {
        source.value = 2;
        assert.equal(derived.value, 5);
        source.value = 3;
        assert.equal(derived.value, 7);
        assert.equal(seen.length, 1);
    });
    assert.deepEqual(seen, [[1, 3], [3, 7]]);
    stop();
});
