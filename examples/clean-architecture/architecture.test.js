import { test } from "node:test";
import assert from "node:assert/strict";
import { createTodo } from "./domain/todo.js";
import { createTodoService } from "./application/todo-service.js";
import { createMemoryTodoRepository } from "./infrastructure/memory-todo-repository.js";

test("business validation trims input and rejects missing titles", () => {
    assert.deepEqual(createTodo("  Ship it  "), { title: "Ship it", completed: false });
    for (const value of ["", "   ", null, 42]) {
        assert.throws(() => createTodo(value), /title is required/);
    }
});

test("invalid input never reaches storage; storage failures reach the caller", async () => {
    let saves = 0;
    const service = createTodoService({
        list: async () => [],
        save: async () => { saves++; throw new Error("Storage unavailable"); }
    });
    await assert.rejects(service.add(" "), /title is required/);
    assert.equal(saves, 0);
    await assert.rejects(service.add("Valid"), /Storage unavailable/);
    assert.equal(saves, 1);
});

test("repository round-trips records without exposing mutable internal state", async () => {
    const repository = createMemoryTodoRepository();
    const service = createTodoService(repository);
    const first = await service.add(" First ");
    const second = await service.add("Second");
    assert.notEqual(first.id, second.id);
    first.title = "Changed";
    const listed = await service.list();
    assert.equal(listed[0].title, "First");
    listed[0].completed = true;
    assert.equal((await service.list())[0].completed, false);
});
