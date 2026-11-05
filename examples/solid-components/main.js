import { mount } from "../../src/index.js";
import { TodoEditor } from "./TodoEditor.js";
import { createTodoService } from "../clean-architecture/application/todo-service.js";
import { createMemoryTodoRepository } from "../clean-architecture/infrastructure/memory-todo-repository.js";
import { createLocalStorageTodoRepository } from "./local-storage-todo-repository.js";

// Only the composition root chooses storage. The editor and service stay the same.
const persistent = new URLSearchParams(window.location.search).get("storage") === "local";
const repository = persistent
    ? createLocalStorageTodoRepository({
        getItem: key => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value)
    })
    : createMemoryTodoRepository();
const todos = createTodoService(repository);
mount(() => TodoEditor({ onSave: title => todos.add(title) }), "#app");
