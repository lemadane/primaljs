import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryTodoRepository } from "../clean-architecture/infrastructure/memory-todo-repository.js";
import { createTodoService } from "../clean-architecture/application/todo-service.js";
import { createLocalStorageTodoRepository } from "./local-storage-todo-repository.js";

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); }
    };
}

// Both implementations must honor the same behavior, not just method names.
for (const [name, factory] of [
    ["memory", () => createMemoryTodoRepository()],
    ["local storage", () => createLocalStorageTodoRepository(createStorage())]
]) {
    test(`${name}: repository contract`, async () => {
        const repository = factory();
        assert.deepEqual(await repository.list(), []);
        const draft = { title: "First", completed: false };
        const first = await repository.save(draft);
        const second = await repository.save({ title: "Second", completed: true });
        assert.equal(typeof first.id, "string");
        assert.notEqual(first.id, second.id);
        assert.equal(first.title, "First");
        assert.equal(first.completed, false);
        draft.title = "Changed input";
        first.title = "Changed result";
        const listed = await repository.list();
        assert.equal(listed[0].title, "First");
        assert.equal(listed[1].completed, true);
        listed[0].completed = true;
        assert.equal((await repository.list())[0].completed, false);
        assert.equal((await repository.list())[1].id, second.id);
    });

    test(`${name}: same save capability works with the todo service`, async () => {
        const repository = factory();
        const service = createTodoService(repository);
        const onSave = title => service.add(title);
        await assert.rejects(onSave("  "), /title is required/);
        assert.deepEqual(await repository.list(), []);
        const saved = await onSave("  Ship it  ");
        assert.equal(saved.title, "Ship it");
        assert.deepEqual(await repository.list(), [saved]);
    });
}

test("local storage persists across repository instances and rejects storage failures", async () => {
    const storage = createStorage();
    const first = createLocalStorageTodoRepository(storage);
    await first.save({ title: "Persisted", completed: false });
    const reopened = createLocalStorageTodoRepository(storage);
    assert.equal((await reopened.list())[0].title, "Persisted");
    const second = await reopened.save({ title: "Next", completed: false });
    assert.notEqual(second.id, (await first.list())[0].id);

    const failing = createLocalStorageTodoRepository({
        getItem: () => null,
        setItem: () => { throw new Error("Storage full"); }
    });
    await assert.rejects(createTodoService(failing).add("Valid"), /Storage full/);
});

test("corrupted local storage rejects without overwriting existing data", async () => {
    for (const invalid of ["not json", '{}', '[{"id":"bad"}]']) {
        const storage = createStorage();
        storage.setItem("test", invalid);
        const repository = createLocalStorageTodoRepository(storage, "test");
        await assert.rejects(repository.list());
        await assert.rejects(repository.save({ title: "Valid", completed: false }));
        assert.equal(storage.getItem("test"), invalid);
    }
});
