import { mount } from "../../src/index.js";
import { createTodoService } from "./application/todo-service.js";
import { createMemoryTodoRepository } from "./infrastructure/memory-todo-repository.js";
import { TodoPage } from "./ui/TodoPage.js";

// Composition root: choose concrete dependencies here, then inject them.
const todos = createTodoService(createMemoryTodoRepository());
mount(() => TodoPage({ todos }), "#app");
