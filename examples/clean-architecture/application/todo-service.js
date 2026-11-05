import { createTodo } from "../domain/todo.js";

/**
 * @typedef {{ id: string, title: string, completed: boolean }} Todo
 * @typedef {Object} TodoRepository
 * @property {() => Promise<Todo[]>} list
 * @property {(todo: { title: string, completed: boolean }) => Promise<Todo>} save
 */

/** @param {TodoRepository} repository */
export function createTodoService(repository) {
    return {
        list: () => repository.list(),
        async add(title) {
            return repository.save(createTodo(title));
        }
    };
}
